import type { Track } from "discord-player";

export const YOUTUBE_REGEX =
	/^https:\/\/(www\.)?youtu(\.be\/.{11}(.+)?|be\.com\/watch\?v=.{11}(&.+)?)/;

export function getVideoId(url: string): string {
	if (!YOUTUBE_REGEX.test(url)) throw new Error("Invalid Youtube Link.");

	let id = new URL(url).searchParams.get("v");
	if (!id) id = url.split("/").at(-1)?.split("?").at(0);

	return id;
}

export function createJsonLikeDebug(track: Track) {
	return `{ title: ${track.title}, url: ${track.url} }`;
}
