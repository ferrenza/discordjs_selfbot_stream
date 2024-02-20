const { Client, StageChannel } = require("discord.js-selfbot-v13");
const { command, streamLivestreamVideo, MediaUdp, setStreamOpts, getInputMetadata, inputHasAudio, Streamer } = require("@dank074/discord-video-stream");
const config = require("./config.json");

const streamer = new Streamer(new Client());

setStreamOpts({
    width: config.streamOpts.width,
    height: config.streamOpts.height,
    fps: config.streamOpts.fps,
    bitrateKbps: config.streamOpts.bitrateKbps,
    maxBitrateKbps: config.streamOpts.maxBitrateKbps,
    hardware_acceleration: config.streamOpts.hardware_acceleration,
    video_codec: config.streamOpts.videoCodec === 'H264' ? 'H264' : 'VP8'
});

// ready event
streamer.client.on("ready", () => {
    console.log(`--- ${streamer.client.user.tag} is ready ---`);
});

// message event
streamer.client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    if (!config.acceptedAuthors.includes(msg.author.id)) return;

    if (!msg.content) return;

    if (msg.content.startsWith(`$play-live`)) {
        const args = parseArgs(msg.content);
        if (!args) return;

        const channel = msg.author.voice.channel;

        if (!channel) return;

        console.log(`Attempting to join voice channel ${msg.guildId}/${channel.id}`);
        await streamer.joinVoice(msg.guildId, channel.id);

        if (channel instanceof StageChannel) {
            await streamer.client.user.voice.setSuppressed(false);
        }

        const streamUdpConn = await streamer.createStream();

        await playVideo(args.url, streamUdpConn);

        streamer.stopStream();
        return;
    } else if (msg.content.startsWith("$play-cam")) {
        const args = parseArgs(msg.content);
        if (!args) return;

        const channel = msg.author.voice.channel;

        if (!channel) return;

        console.log(`Attempting to join voice channel ${msg.guildId}/${channel.id}`);
        const vc = await streamer.joinVoice(msg.guildId, channel.id);

        if (channel instanceof StageChannel) {
            await streamer.client.user.voice.setSuppressed(false);
        }

        streamer.signalVideo(msg.guildId, channel.id, true);

        playVideo(args.url, vc);

        return;
    } else if (msg.content.startsWith("$disconnect")) {
        command?.kill("SIGINT");

        streamer.leaveVoice();
    } else if (msg.content.startsWith("$stop-stream")) {
        command?.kill('SIGINT');

        const stream = streamer.voiceConnection?.streamConnection;

        if (!stream) return;

        streamer.stopStream();
    }
});

// login
streamer.client.login(config.token);

async function playVideo(video, udpConn) {
    let includeAudio = true;

    try {
        const metadata = await getInputMetadata(video);
        //console.log(JSON.stringify(metadata.streams));
        includeAudio = inputHasAudio(metadata);
    } catch (e) {
        console.log(e);
        return;
    }

    console.log("Started playing video");

    udpConn.mediaConnection.setSpeaking(true);
    udpConn.mediaConnection.setVideoStatus(true);
    try {
        const res = await streamLivestreamVideo(video, udpConn, includeAudio);

        console.log("Finished playing video " + res);
    } catch (e) {
        console.log(e);
    } finally {
        udpConn.mediaConnection.setSpeaking(false);
        udpConn.mediaConnection.setVideoStatus(false);
    }
    command?.kill("SIGINT");
}

function parseArgs(message) {
    const args = message.split(" ");
    if (args.length < 2) return;

    const url = args[1];

    return { url };
}
