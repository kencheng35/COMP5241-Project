export function VisibilityLabel({ visibility }: { visibility: string }) {
  const published = visibility === "public";
  return <span className={`visibility-label ${published ? "visibility-public" : "visibility-private"}`}>{published ? "Published" : "Private"}</span>;
}
