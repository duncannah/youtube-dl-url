const fs = require("fs-extra");
const path = require("path");
const express = require("express");
const request = require("request");
//const builder = require("xmlbuilder");
const { execFile } = require("promisify-child-process");

const app = express();

const PORT = parseInt(process.env.PORT || "3000", 10);

const YTDL_PY = "python3";
const YTDL_PATH = path.join(__dirname, "/bin/youtube-dl");
const YTDL_ARG = [YTDL_PATH, "--no-warnings"];
const YTDL_EXECOPT = { maxBuffer: 1000 * 1000 * 2 };

const updateYTDL = () =>
	new Promise((resv) => {
		try {
			if (fs.statSync(YTDL_PATH).mtimeMs <= new Date().getTime() - 1000 * 60 * 60 * 6) throw Error;
			else resv();
		} catch (error) {
			let tmpName = YTDL_PATH + "." + new Date().getTime();

			request("https://yt-dl.org/downloads/latest/youtube-dl")
				.pipe(fs.createWriteStream(tmpName))
				.on("finish", async () => {
					await fs.move(tmpName, YTDL_PATH, { overwrite: true });
					resv();
				});
		}
	});

updateYTDL().then(() => setInterval(updateYTDL, 1000 * 60 * 60 * 6));

app.get("/favicon.ico", (_, res) => {
	res.status(404).send();
});

app.get("*", async (req, res) => {
	const BASE_URL = req.protocol + "://" + req.headers.host;

	const url = req.url.substr(1);
	if (
		!url.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/) &&
		!url.match(/^\w+:.+$/) // ytdl extractor
	)
		return res.status(404).send("URL not valid");

	let json = {};

	try {
		json = JSON.parse(
			(await execFile(YTDL_PY, [...YTDL_ARG, "-J", "--flat-playlist", "--", url], YTDL_EXECOPT)).stdout
				.toString()
				.split("\n")[0]
		);
	} catch (error) {
		console.error(error);

		return res.status(500).send("Failed");
	}

	let m3u8 = "#EXTM3U\n";

	if (json.direct) {
		m3u8 += "#EXTINF:-1," + json.title + "\n" + json.url + "\n";
		res.send(m3u8);
	} else if (json._type === "playlist" || json._type === "multi_video") {
		if (!json.entries) return res.status(404).send("Empty playlist");

		if (json.entries === 1) {
			m3u8 +=
				"#EXTINF:-1," +
				json.entries[0].title +
				"\n" +
				(json.entries[0].url.includes(":")
					? BASE_URL + "/" + json.entries[0].url
					: BASE_URL + "/https://youtu.be/" + json.entries[0].url) +
				"\n";
		} else {
			for (const entry of json.entries) {
				m3u8 +=
					"#EXTINF:-1," +
					(entry.title || entry.url) +
					"\n" +
					(entry.url.includes(":")
						? BASE_URL + "/" + entry.url
						: BASE_URL + "/https://youtu.be/" + entry.url) +
					"\n";
			}
		}

		res.send(m3u8);
	} else {
		const bestDirectFormat = json.formats
			.reverse()
			.filter((f) => !f.fragments && f.vcodec !== "none" && f.acodec !== "none")[0];

		res.redirect(bestDirectFormat.url);
	}

	/*

	let mpd = builder
		.create("mpd", {
			"xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
			xmlns: "urn:mpeg:dash:schema:mpd:2011",
			"xsi:schemaLocation": "urn:mpeg:dash:schema:mpd:2011 DASH-MPD.xsd",
			type: "static",
			mediaPresentationDuration: "PT654S",
			minBufferTime: "PT2S",
			profiles: "urn:mpeg:dash:profile:isoff-on-demand:2011"
		})
		.ele("BaseURL", json.webpage_url)
		.up();

	for (const format of json.formats.reverse()) {
		mpd.ele("Period").ele("AdaptationSet", {
			mimetype: format.vcodec === "none" ? "audio/" : "video/" + format.ext,
			codecs: 
		});

		const arr = ["BANDWIDTH=" + Math.round(format.tbr || format.height || 1080)];

		if (format.width || format.height)
			arr.push(
				"RESOLUTION=" +
					(format.width && format.height
						? format.width + "x" + format.height
						: !format.width && format.height
						? format.height + "x" + format.height
						: "1920x1080")
			);

		m3u8 += "#EXT-X-STREAM-INF:" + arr.join(",") + "\n" + format.url + "\n";
	}

	return;

	let m3u8 = "#EXTM3U\n";

	if (json.direct) {
		m3u8 += "#EXT-X-STREAM-INF:BANDWIDTH=1080\n" + json.url + "\n";
	} else if (json._type === "playlist" || json._type === "multi_video") {
		if (!json.entries) return res.status(404).send("Empty playlist");

		if (json.entries === 1) {
			m3u8 +=
				"#EXTINF:-1," +
				json.entries[0].title +
				"\n" +
				(json.entries[0].url.includes(":")
					? BASE_URL + "/" + json.entries[0].url
					: BASE_URL + "/https://youtu.be/" + json.entries[0].url) +
				"\n";
		} else {
			for (const entry of entries) {
				m3u8 +=
					"#EXTINF:-1," +
					entry.title +
					"\n" +
					(entry.url.includes(":")
						? BASE_URL + "/" + entry.url
						: BASE_URL + "/https://youtu.be/" + entry.url) +
					"\n";
			}
		}
	} else {
		// pick best format
		//const bestFormat = json.formats.filter((f) => f.format_id === json.format_id)[0]

		for (const format of json.formats.reverse()) {
			const arr = ["BANDWIDTH=" + Math.round(format.tbr || format.height || 1080)];

			if (format.width || format.height)
				arr.push(
					"RESOLUTION=" +
						(format.width && format.height
							? format.width + "x" + format.height
							: !format.width && format.height
							? format.height + "x" + format.height
							: "1920x1080")
				);

			m3u8 += "#EXT-X-STREAM-INF:" + arr.join(",") + "\n" + format.url + "\n";
		}
	}

	res.send(m3u8);
	*/
});

app.listen(PORT, () => console.log("Server listening on port " + PORT));
