import { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from "discord.js";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ================= DATABASE (ANTI RESET) =================
const DATA_FILE = "./data.json";

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ users: {}, pendingGives: {} }, null, 2)
    );
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

const db = loadData();
const users = db.users;
const usedRedeemCodes = db.usedRedeemCodes || {};
db.usedRedeemCodes = usedRedeemCodes;
const pendingGives = db.pendingGives;


// ================= EMOJI =================
const EMOJI_HEAD = "<:Ezie_head:1459587453362114734>";
const EMOJI_TAIL = "<:Ezie_tail:1459591324985593878>";
const EMOJI_SPIN = "<a:Ezie_coinflip:1459769222790905907>";
const EMOJI_CASH = "<a:Donatur:1435785496780472381>";

// ================= UTIL =================
function formatCash(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function getUser(id) {
  if (!users[id]) {
    users[id] = { cash: 1000, redeemCount: 0, lastDaily: 0 };
    saveData();
  }
  return users[id];
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ================= READY =================
client.once("ready", () => {
  console.log(`🤖 Bot aktif sebagai ${client.user.tag}`);
});

// ================= MESSAGE =================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const args = msg.content.trim().split(/\s+/);
  const lower = msg.content.toLowerCase();
  const user = getUser(msg.author.id);

  // ===== CASH =====
  if (lower === "z cash" || lower === "zcash") {
    return msg.reply(
      `${EMOJI_CASH}**| ${msg.author.username}**, you currently have **__${formatCash(
        user.cash
      )} Eziecy!__**`
    );
  }

  // ===== DAILY (15:00 WIB) =====
  if (lower === "z daily" || lower === "z d" || lower === "zd" || lower === "zdaily") {
    const now = new Date();
    const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const reset = new Date(wib);
    reset.setHours(15, 0, 0, 0);
    if (wib < reset) reset.setDate(reset.getDate() - 1);

    if (user.lastDaily >= reset.getTime()) {
      return msg.reply("❌ Daily sudah diambil hari ini");
    }

    const reward = Math.floor(Math.random() * 4000) + 1000;
    user.cash += reward;
    user.lastDaily = now.getTime();
    saveData();

    return msg.reply(
      `🎁 DAILY ${EMOJI_CASH} **+${formatCash(reward)} Eziecy**`
    );
  }

  // ===== LEADERBOARD =====
  if (lower === "z lb" || lower === "z leaderboard" || lower === "zlb" || lower === "zleaderboard") {
    const sorted = Object.entries(users)
      .sort((a, b) => b[1].cash - a[1].cash)
      .slice(0, 10);

    if (!sorted.length) return msg.reply("❌ Belum ada data");

    let text = "🏆 **LEADERBOARD CASH**";
    sorted.forEach(([id, data], i) => {
      const u = client.users.cache.get(id);
      if (u)
        text += `\n${i + 1}. ${u.username} ${EMOJI_CASH} ${formatCash(
          data.cash
        )}`;
    });

    return msg.reply(text);
  }

  // ===== REDEEM =====
// ===== REDEEM (AMAN, 1X PAKAI, AUTO DELETE CHAT) =====
if (args[0]?.toLowerCase() === "redeem") {
  const code = args[1];
  if (!code) return;

  // hapus pesan kalau dari server
  if (msg.guild) {
    await msg.delete().catch(() => {});
  }

  // cek kode sudah dipakai
  if (usedRedeemCodes[code]) {
    return msg.author.send("❌ Kode ini sudah digunakan.");
  }

  // ganti kode di sini (kamu bisa ubah kapan saja)
  const VALID_CODES = ["MUS4"];

  if (!VALID_CODES.includes(code)) {
    return msg.author.send("❌ Kode redeem tidak valid.");
  }

  // redeem berhasil
  usedRedeemCodes[code] = true;
  user.cash += 10_000_000;

  saveData();

  return msg.author.send(
    `🛡️ REDEEM BERHASIL\n` +
    `${EMOJI_CASH} +${formatCash(10_000_000)} Eziecy\n` +
    `Kode ini sekarang sudah tidak bisa digunakan lagi.`
  );
}

  // ===== COIN FLIP =====
  if (args[0]?.toLowerCase() === "cf") {
    let amount = 1;
    let choice = "h";

    if (args[1]) {
      if (args[1] === "all") amount = user.cash;
      else if (!isNaN(args[1])) amount = parseInt(args[1]);
      else if (args[1] === "h" || args[1] === "t") choice = args[1];
    }
    if (args[2] === "h" || args[2] === "t") choice = args[2];

    if (amount <= 0 || amount > user.cash)
      return msg.reply("❌ Cash tidak cukup");

    user.cash -= amount;
    saveData();

    const sent = await msg.reply(
      `**${msg.author.username}** spent ${EMOJI_CASH} **${formatCash(
        amount
      )}** and chose **${choice === "h" ? "heads" : "tails"}**,\n` +
        `The coin spins... ${EMOJI_SPIN}`
    );

    await delay(2000);

    const result = Math.random() < 0.5 ? "h" : "t";
    const resultEmoji = result === "h" ? EMOJI_HEAD : EMOJI_TAIL;

    if (result === choice) {
      const win = amount * 2;
      user.cash += win;
      saveData();

      return sent.edit(
        `**${msg.author.username}** spent ${EMOJI_CASH} **${formatCash(
          amount
        )}** and chose **${choice === "h" ? "heads" : "tails"}**,\n` +
          `The coin spins... ${resultEmoji} and you won ${EMOJI_CASH} **${formatCash(win)}**!!`
      );
    } else {
      return sent.edit(
        `**${msg.author.username}** spent ${EMOJI_CASH} **${formatCash(
          amount
        )}** and chose **${choice === "h" ? "heads" : "tails"}**,\n` +
          `The coin spins... ${resultEmoji} and you lost it all... :c`
      );
    }
  }

  // ===== GIVE =====
  if (args[0]?.toLowerCase() === "give") {
    const target = msg.mentions.users.first();
    const amount = parseInt(args[args.length - 1]);

    if (!target) return msg.reply("❌ Contoh: give @user amount");
    if (isNaN(amount) || amount <= 0) return msg.reply("❌ Nominal tidak valid");
    if (amount > user.cash) return msg.reply("❌ Cash tidak cukup");
    if (target.id === msg.author.id)
      return msg.reply("❌ Tidak bisa ke diri sendiri");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("give_confirm")
        .setLabel("✔")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("give_cancel")
        .setLabel("✖")
        .setStyle(ButtonStyle.Danger)
    );

    const sent = await msg.reply({
      content: `💸 GIVE ${msg.author.username} ➜ ${target.username} ${EMOJI_CASH} ${formatCash(
        amount
      )}`,
      components: [row],
    });

    pendingGives[sent.id] = {
      from: msg.author.id,
      to: target.id,
      amount,
    };
    saveData();
  }
});

// ================= BUTTON =================
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  const data = pendingGives[i.message.id];
  if (!data) return;

  if (i.user.id !== data.from)
    return i.reply({ content: "❌ Bukan pengirim", ephemeral: true });

  const giver = getUser(data.from);
  const receiver = getUser(data.to);

  if (i.customId === "give_confirm") {
    if (giver.cash < data.amount)
      return i.update({ content: "❌ Cash tidak cukup", components: [] });

    giver.cash -= data.amount;
    receiver.cash += data.amount;
    delete pendingGives[i.message.id];
    saveData();

    return i.update({
      content: `✅ GIVE SUCCESS ${EMOJI_CASH} ${formatCash(data.amount)}`,
      components: [],
    });
  }

  if (i.customId === "give_cancel") {
    delete pendingGives[i.message.id];
    saveData();
    return i.update({ content: "❌ GIVE DIBATALKAN", components: [] });
  }

  if (msg.content === "!RULES") {
    const rulesEmbed = new EmbedBuilder()
      .setColor("#FFA500") // 🟧 warna garis oranye
      .setTitle("📜  PERATURAN EZIE")
      .setDescription(`
**1. Saling Menghormati**
EZIE Server dibangun atas dasar kebersamaan. Semua anggota berhak merasa aman dan diterima. Tidak ada tempat untuk pelecehan, diskriminasi, hinaan, rasisme, atau tindakan yang merugikan orang lain.

**2. Etika Berbicara**
Gunakan bahasa yang sopan di teks maupun voice. Hindari kata kasar, nada merendahkan, atau candaan berlebihan. Jangan bawa topik sensitif seperti politik atau agama.

**3. Sikap & Kelompok**
Jangan membuat circle tertutup yang membuat orang lain merasa dikucilkan. Jadilah anggota yang terbuka dan ramah pada siapa pun.

**4. Akses & Fasilitas**
Gunakan role, permission, dan bot dengan tanggung jawab. Laporkan bug atau masalah dengan benar, jangan disalahgunakan.

**5. Informasi & Keaslian**
Pastikan informasi yang dibagikan benar dan memiliki sumber jelas. Dilarang menyebar hoax, link palsu, atau penipuan dalam bentuk apa pun.

**6. Identitas & Privasi**
Hormati identitas pribadi orang lain. Dilarang menyamar, meniru staff, atau menyebarkan data pribadi tanpa izin. Gunakan nama dan avatar yang pantas.

**7. Anti-Spam**
Gunakan channel secara wajar. Hindari spam teks, emoji, gambar, atau mention berlebihan.

**8. Larangan Promosi**
Segala bentuk promosi — termasuk server lain, akun pribadi, jual-beli, atau link iklan — tidak diperbolehkan tanpa izin admin.

**9. Konten Dewasa (NSFW)**
Server ini aman untuk semua kalangan. Konten pornografi, gore, atau kekerasan ekstrem dilarang keras.

**10. Gunakan Channel Sesuai Tujuan**
Baca deskripsi setiap channel dan gunakan sesuai topik. Bila ragu, tanyakan pada staff.

🎉 **Selamat Datang di EZIE!**
Kami percaya komunitas ini bisa jadi tempat nyaman untuk tumbuh, berbagi, dan bersenang-senang bersama selama semua anggota saling menghormati.
`)
      .setImage("attachment://banner.png") // gambar banner
      .setFooter({ text: "© EZIE | Stay respectful 🧡" })
      .setTimestamp();

    await msg.channel.send({
      embeds: [rulesEmbed],
      files: [
        {
          attachment: "C:\\Users\\Lenovo\\Desktop\\Penting\\emuz server\\rules dc.jpg",
          name: "banner.png",
        },
      ],
    });
  }

  if (msg.content === "!halo") {
    msg.reply(`Halo ${msg.author.username}! 👋`);
  }
});

client.login(process.env.DISCORD_TOKEN);
