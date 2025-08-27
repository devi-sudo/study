// server.js
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import fs from "fs";
import path from "path";
import express from "express";

const token = process.env.BOT_TOKEN; // Render stores in Environment
const bot = new TelegramBot(token, { polling: true });

const app = express();
app.get("/", (req, res) => res.send("Study Helper Bot is Running 🚀"));
app.listen(process.env.PORT || 3000, () => console.log("Server started"));

// Store user queues
let userQueues = {};
let referrals = {}; // {userId: [referredUserIds]}

// ===================== START GREETING =====================
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const refParam = match[1]?.trim();

  let greeting = `👋 *Hello ${msg.from.first_name}!* \n\nWelcome to *📚 Study Helper Bot*.\n\n✨ Upload a *.txt file* with your study links and I’ll send you videos one by one with notes.\n\n`;

  // Handle referral
  if (refParam && refParam.startsWith("ref_")) {
    const referrerId = refParam.replace("ref_", "");
    if (referrerId !== chatId.toString()) {
      if (!referrals[referrerId]) referrals[referrerId] = [];
      referrals[referrerId].push(chatId.toString());
      greeting += `🎉 You joined using a referral link!\nThanks to user *${referrerId}*.`;
      bot.sendMessage(referrerId, `🎉 Your friend *${msg.from.first_name}* just joined via your referral link!`);
    }
  }

  const referralLink = `https://t.me/${(await bot.getMe()).username}?start=ref_${chatId}`;
  greeting += `\n\n🤝 Share with friends:\n${referralLink}`;

  bot.sendMessage(chatId, greeting, { parse_mode: "Markdown" });
});

// ===================== HANDLE TXT FILES =====================
bot.on("document", async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;

  try {
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    const response = await axios.get(fileUrl);
    const lines = response.data.split("\n").filter(l => l.trim() !== "");

    const queue = lines
      .map(line => {
        const [title, url] = line.split(": ").map(x => x.trim());
        return { title, url };
      })
      .filter(item => item.url.endsWith(".mp4"));

    if (!queue.length) {
      bot.sendMessage(chatId, "⚠️ No videos found in the file.");
      return;
    }

    userQueues[chatId] = queue;
    bot.sendMessage(chatId, `✅ *File received!* I found *${queue.length} videos*.`, { parse_mode: "Markdown" });
    sendNextVideo(chatId);
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "❌ Error processing file.");
  }
});

// ===================== SEND NEXT VIDEO =====================
async function sendNextVideo(chatId) {
  const queue = userQueues[chatId];
  if (!queue || queue.length === 0) {
    bot.sendMessage(chatId, "🎉 *All videos sent!*", { parse_mode: "Markdown" });
    return;
  }

  const { title, url } = queue.shift();
  const caption = `🎓 *${title.split("-").slice(1, 2).join(" ").trim()}*`;

  try {
    const fileName = path.basename(url);
    const filePath = path.join(process.cwd(), fileName);

    const writer = fs.createWriteStream(filePath);
    const response = await axios.get(url, { responseType: "stream" });
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    await bot.sendVideo(chatId, filePath, { caption, parse_mode: "Markdown" });
    fs.unlinkSync(filePath);

    bot.sendMessage(chatId, "➡️ Can I send next?", {
      reply_markup: {
        keyboard: [["✅ Yes", "❌ No"]],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    });
  } catch (err) {
    console.error("Error sending video:", err);
    bot.sendMessage(chatId, "⚠️ Failed to send video.");
  }
}

// ===================== USER REPLY =====================
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  if (msg.text === "✅ Yes") {
    sendNextVideo(chatId);
  } else if (msg.text === "❌ No") {
    bot.sendMessage(chatId, "⏸️ Okay, I’ll stop for now.");
    delete userQueues[chatId];
  }
});
