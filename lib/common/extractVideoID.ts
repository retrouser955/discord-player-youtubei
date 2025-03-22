export function extractVideoId(vid: string) {
  const YOUTUBE_REGEX =
    /^https:\/\/(www\.)?youtu(\.be\/.{11}(.+)?|be\.com\/watch\?v=.{11}(&.+)?)/;
  if (!YOUTUBE_REGEX.test(vid)) throw new Error("Invalid youtube url");

  let id = new URL(vid).searchParams.get("v");
  // VIDEO DETECTED AS YT SHORTS OR youtu.be link
  if (!id) id = vid.split("/").at(-1)?.split("?").at(0)!;

  return id;
}
