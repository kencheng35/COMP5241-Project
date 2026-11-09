"use server";

import {z} from "zod";
import {accessibleLesson,canEditLesson,currentUser,database,isAdmin} from "@/lib/learning-server";
import {cleanupPresentationAssets,ownedPresentationDraft,PRESENTATION_BUCKET} from "@/lib/presentation-assets-server";
import {sanitizePresentationImage} from "@/lib/presentation-images";

const uncertainDraft = "A draft may have been created. Ask an administrator to check before trying again.";
const draftStartMessages = {
  auth_required: "Log in again to start image storage; your session could not be verified.",
  invalid_lesson: "Choose a valid lesson before starting image storage.",
  forbidden: "You cannot edit this lesson.",
  draft_limit: "The limit of 10 active image drafts has been reached. Discard only a draft you no longer need, or wait for drafts to expire.",
  missing_schema: "Image storage setup is unavailable. Ask an administrator to verify the presentation migration, RPC and schema cache in the configured Supabase project.",
  permission_config: "Image storage access is unavailable. Ask an administrator to verify service-role permissions and Vercel environment configuration use the same Supabase project.",
  transient: `Image storage is temporarily unavailable or the request was interrupted. ${uncertainDraft}`,
  unexpected: `Image storage could not be confirmed because of an unexpected failure. ${uncertainDraft}`,
  invalid_acknowledgment: `Image storage did not return a valid draft ID. ${uncertainDraft}`,
};
type DraftStartCategory = keyof typeof draftStartMessages;
// Only reviewed codes are logged; never serialize messages, details, hints or identities.
const draftStartCodes: Record<string, DraftStartCategory> = {
  P0001: "unexpected",
  PGRST202: "missing_schema", PGRST205: "missing_schema", "42883": "missing_schema",
  "42P01": "missing_schema", "3F000": "missing_schema",
  "42501": "permission_config", "28000": "permission_config", "28P01": "permission_config",
  PGRST301: "permission_config", PGRST302: "permission_config", PGRST303: "permission_config", PGRST106: "permission_config",
  "08006": "transient", "53300": "transient", "57P01": "transient", "57014": "transient",
  "40001": "transient", "40P01": "transient",
  PGRST000: "transient", PGRST001: "transient", PGRST002: "transient", PGRST003: "transient",
};
function draftStartFailure(category: DraftStartCategory, code: string | null = null) {
  try {
    console.error(JSON.stringify({event: "presentation_draft_start_failed", category, code}));
  } catch { /* Logging must not replace the sanitized action result. */ }
  return {error: draftStartMessages[category]};
}
function draftStartError(error: unknown, status?: number, creating = false) {
  const fields = error && typeof error === "object" ? error as {code?: unknown; message?: unknown} : {};
  const code = typeof fields.code === "string" && Object.hasOwn(draftStartCodes, fields.code) ? fields.code : null;
  // P0001 alone is any user-raised SQL exception, not evidence of this quota.
  const category = creating && code === "P0001" && fields.message === "draft limit" ? "draft_limit"
    : code ? draftStartCodes[code]
    : status === 401 || status === 403 ? "permission_config"
    : status !== undefined && [0, 408, 429, 502, 503, 504].includes(status) ? "transient" : "unexpected";
  return draftStartFailure(category, code);
}

export async function beginPresentationDraft(lessonId?:string):Promise<{id?:string;error?:string}> {
  let stage: "auth" | "access" | "database" | "rpc" = "auth";
  try{
    const user=await currentUser();
    stage = "access";
    if(lessonId){
      if(!z.uuid().safeParse(lessonId).success)return draftStartFailure("invalid_lesson");
      const lesson=await accessibleLesson(lessonId,user,true);
      if(!lesson||!canEditLesson(user,lesson))return draftStartFailure("forbidden");
    }
    stage = "database";
    const client=database();
    stage = "rpc";
    // Exactly one create attempt. A lost/malformed acknowledgment cannot safely be retried or cleaned up here.
    const response=await client.rpc("forge_begin_presentation_draft",{request_owner:user.id,request_lesson:lessonId??null});
    if(response?.error)return draftStartError(response.error,response.status,true);
    const id=z.uuid().safeParse(response?.data);
    if(!id.success)return draftStartFailure("invalid_acknowledgment");
    return {id:id.data};
  }catch(error){
    if(error instanceof Error&&[
      "Learning services are not configured.",
      "Learning service configuration is unavailable. Check the public Supabase URL, anon key and site origin.",
    ].includes(error.message))return draftStartFailure("permission_config");
    if(stage==="auth")return draftStartFailure("auth_required");
    return draftStartError(error,undefined,stage==="rpc");
  }
}
export async function uploadPresentationImage(form:FormData):Promise<{id?:string;width?:number;height?:number;error?:string}> {
  let reserved:string|undefined;
  try{
    const user=await currentUser();
    const {draft,lesson}=await ownedPresentationDraft(z.uuid().parse(form.get("draftId")),user);
    const file=form.get("image");
    if(!(file instanceof File))throw new Error("Choose a PNG/JPEG file.");
    if(file.size>4*1024*1024)throw new Error("Use an image no larger than 4 MiB.");
    const image=await sanitizePresentationImage(new Uint8Array(await file.arrayBuffer()));
    const id=crypto.randomUUID(),path=`${draft.id}/${id}.png`;
    const client=database();
    const {error:reserveError}=await client.rpc("forge_reserve_presentation_asset",{request_draft:draft.id,request_editor:user.id,request_owner:lesson?.owner_id??user.id,
      request_id:id,request_path:path,request_bytes:image.data.length,request_width:image.width,request_height:image.height});
    if(reserveError)throw new Error("Image storage limit reached or draft expired (64 MiB per draft).");
    reserved=id;
    const {error}=await client.storage.from(PRESENTATION_BUCKET).upload(path,image.data,{contentType:"image/png",upsert:false});
    if(error)throw new Error("Image upload was not confirmed. Reserved metadata is retained for cleanup.");
    const {data,error:readyError}=await client.from("forge_presentation_assets").update({status:"ready"}).eq("id",id).eq("status","pending").select("id").single();
    if(readyError||!data)throw new Error("Image upload acknowledgement failed. Retry with a new upload; this reservation will be cleaned.");
    return {id,width:image.width,height:image.height};
  }catch(error){return {error:`${error instanceof Error?error.message:"Image upload failed."}${reserved?" Unused uploads remain private until draft cleanup.":""}`};}
}
export async function discardPresentationDraft(id:string):Promise<{error?:string;success?:string}> {
  try{
    const user=await currentUser();await ownedPresentationDraft(id,user,true);
    const {error}=await database().from("forge_presentation_drafts").update({expires_at:new Date().toISOString()}).eq("id",id).eq("owner_id",user.id);
    if(error)throw new Error("Could not discard the image draft.");
    await cleanupPresentationAssets(user.id);
    return {success:"Unused private images removed. Saved lesson images are retained."};
  }catch(error){return {error:error instanceof Error?error.message:"Draft cleanup failed. Retry."};}
}
export async function cleanExpiredPresentationUploads():Promise<{error?:string;success?:string}> {
  try{const user=await currentUser();await cleanupPresentationAssets(isAdmin(user)?null:user.id);return {success:"Expired unused uploads cleaned."};}
  catch(error){return {error:error instanceof Error?error.message:"Cleanup failed."};}
}
