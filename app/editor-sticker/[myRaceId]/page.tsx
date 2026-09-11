import { EditorStickerClient } from "./client";

export default async function EditorStickerPage({
  params,
}: {
  params: Promise<{ myRaceId: string }>;
}) {
  const { myRaceId } = await params;
  return <EditorStickerClient myRaceId={myRaceId} />;
}
