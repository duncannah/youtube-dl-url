const fs = require("fs-extra");
const path = require("path");
const express = require("express");
const request = require("request");
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

			request("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp")
				.pipe(fs.createWriteStream(tmpName))
				.on("finish", async () => {
					await fs.move(tmpName, YTDL_PATH, { overwrite: true });
					resv();
				});
		}
	});

app.get("/favicon.ico", (_, res) => {
	res.status(404).send();
});

app.get("*", async (req, res) => {
	const BASE_URL = req.protocol + "://" + req.headers.host;

	const url = req.url
		.substr(1)
		.replace(/^http:\//, "http://")
		.replace(/^https:\//, "https://");

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
});

fs.ensureDir(path.join(__dirname, "/bin")).then(() =>
	updateYTDL().then(() => {
		setInterval(updateYTDL, 1000 * 60 * 60 * 6);
		app.listen(PORT, () => console.log("Server listening on port " + PORT));
	})
);
