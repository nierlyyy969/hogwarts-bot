require('dotenv').config();
const mongoose = require('mongoose');

const {
    Client,
    GatewayIntentBits,
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');

const User = require('./models/User'); 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// ==========================================
// PENGATURAN HOGWARTS & DATABASE
// ==========================================
const OWNER_ID = '1180180812327559310'; 
const LEVEL_UP_CHANNEL_ID = '1475801714425860272'; 
const EMBED_COLOR = '#25a5cf'; // Kode warna embed konsisten

const HOUSES_DATA = [
    { id: '1475605712938864796', name: 'Gryffindor', emoji: '🦁', command: 'gryffindor' },
    { id: '1475786100210401413', name: 'Slytherin', emoji: '🐍', command: 'slytherin' },
    { id: '1475786808167235604', name: 'Ravenclaw', emoji: '🦅', command: 'ravenclaw' },
    { id: '1475787032759631965', name: 'Hufflepuff', emoji: '🦡', command: 'hufflepuff' }
];

let housePointsCache = {
    'Gryffindor': 0,
    'Slytherin': 0,
    'Ravenclaw': 0,
    'Hufflepuff': 0
};

function getXpNeededForNextLevel(level) {
    if (level >= 9999) return 49995;
    return level * 5; 
}

function getWizardTitle(level, userId) {
    if (userId === OWNER_ID) return 'Lord of Magic';
    if (level >= 900) return 'Ancient Archmage';
    if (level >= 800) return 'Grand Sorcerer';
    if (level >= 700) return 'Chief Warlock';
    if (level >= 600) return 'Order of the Merlin';
    if (level >= 500) return 'Auror Commander';
    if (level >= 400) return 'Undersecretary';
    if (level >= 300) return 'Department Head';
    if (level >= 200) return 'Elite Auror';
    if (level >= 150) return 'Master Alchemist';
    if (level >= 100) return 'Ministry Official';
    if (level >= 75)  return 'Head Boy / Head Girl';
    if (level >= 50)  return 'Prefect';
    if (level >= 40)  return 'Hogwarts Graduate';
    if (level >= 35)  return 'Seventh Year';
    if (level >= 30)  return 'Sixth Year';
    if (level >= 25)  return 'Fifth Year (O.W.L.)';
    if (level >= 20)  return 'Fourth Year';
    if (level >= 15)  return 'Third Year';
    if (level >= 10)  return 'Second Year';
    if (level >= 5)   return 'First Year';
    return 'New Student';
}

const xpCooldowns = new Set();

// ==========================================
// KONEKSI DATABASE & BOT READY
// ==========================================
mongoose.connect(process.env.MONGO_URL || process.env.MONGODB_URI)
.then(() => {
    console.log('🔗 Connected to MongoDB Database successfully!');
    client.login(process.env.DISCORD_TOKEN);
}).catch(err => {
    console.error('❌ Failed to connect to MongoDB:', err);
});

client.once(Events.ClientReady, () => {
    console.log(`✨ Logged in as ${client.user.tag} — System online! ✨`);

    // Voice XP Loop Anti Reset
    setInterval(async () => {
        try {
            const guilds = client.guilds.cache;
            for (const [guildId, guild] of guilds) {
                guild.voiceStates.cache.forEach(async (voiceState) => {
                    const userId = voiceState.id;

                    if (voiceState.channelId && !voiceState.member.user.bot && userId !== OWNER_ID) {
                        let userDoc = await User.findOne({ userId, guildId: guild.id });
                        if (!userDoc) {
                            userDoc = new User({ userId, guildId: guild.id, xp: 0, level: 1, galleons: 0 });
                        }

                        if (userDoc.level >= 1000) return;

                        userDoc.xp += 12;

                        const userHouseObj = HOUSES_DATA.find(h => voiceState.member.roles.cache.has(h.id));
                        if (userHouseObj) {
                            housePointsCache[userHouseObj.name] = (housePointsCache[userHouseObj.name] || 0) + 1;
                        }

                        let xpNeeded = getXpNeededForNextLevel(userDoc.level);
                        let levelUpOccurred = false;
                        let reachedLevelCheckpoint = false;

                        while (userDoc.xp >= xpNeeded) {
                            userDoc.xp -= xpNeeded;
                            userDoc.level += 1;
                            xpNeeded = getXpNeededForNextLevel(userDoc.level);
                            levelUpOccurred = true;

                            if (userDoc.level % 5 === 0) {
                                reachedLevelCheckpoint = true;
                            }

                            if (userDoc.level >= 1000) {
                                userDoc.level = 1000;
                                userDoc.xp = 0;
                                break;
                            }
                        }

                        await userDoc.save();

                        if (levelUpOccurred && reachedLevelCheckpoint) {
                            const newTitle = getWizardTitle(userDoc.level, userId);
                            const levelUpChannel = guild.channels.cache.get(LEVEL_UP_CHANNEL_ID);
                            
                            if (levelUpChannel) {
                                const levelUpEmbed = new EmbedBuilder()
                                    .setColor(EMBED_COLOR) 
                                    .setTitle('✨ Hogwarts Academy Milestone!')
                                    .setDescription(`Selamat! <@${userId}> telah mencapai **Level ${userDoc.level}** dan kini bergelar **${newTitle}**! 🎓 Pencapaian yang luar biasa!`)
                                    .setTimestamp();

                                levelUpChannel.send({ embeds: [levelUpEmbed] }).catch(console.error);
                            }
                        }
                    }
                });
            }
        } catch (err) {
            console.error('Masalah saat memproses Voice XP Loop:', err);
        }
    }, 60000); 
});

client.on(Events.GuildMemberRemove, async (member) => {
    try {
        await User.findOneAndDelete({ userId: member.id, guildId: member.guild.id });
        console.log(`🧹 Data level dari ${member.user.username} di-reset otomatis karena keluar server.`);
    } catch (err) {
        console.error('Gagal menghapus data member keluar:', err);
    }
});

// ==========================================
// EVENT HANDLER CHAT (Sistem Utama)
// ==========================================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const args = message.content.split(' ');
    const command = args[0].toLowerCase();

    const levelUpChannel = message.guild.channels.cache.get(LEVEL_UP_CHANNEL_ID) || message.channel;
    const userHouseObj = HOUSES_DATA.find(h => message.member.roles.cache.has(h.id));

    const isOwner = userId === OWNER_ID;
    const isSorted = !!userHouseObj;

    // A. HELP DIRECTORY COMMAND
    if (command === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle('📜 Hogwarts Academy - Command Directory')
            .setDescription('Berikut adalah daftar mantra (*command*) yang dapat kamu gunakan di akademi sihir ini, dikelompokkan berdasarkan fungsinya:')
            .addFields(
                { 
                    name: '🏰 Sistem Akademik & Informasi', 
                    value: 
                        '`!profile`        — Melihat tingkat sihir, gelar, dan progres XP.\n' +
                        '`!student`        — Roster / daftar murid aktif tiap asrama.\n' +
                        '`!leaderboard`    — Klasemen turnamen House Cup.'
                },
                { 
                    name: '🪙 Sistem Keuangan & Dompet (Currency)', 
                    value: 
                        '`!absen`          — Mengambil tunjangan harian XP & Galleon.\n' +
                        '`!cash`           — Memeriksa isi dompet sihir & pundi asrama.\n' +
                        '`!send`           — Mengirimkan Galleon ke sesama murid.'
                },
                { 
                    name: '🎲 Kasino Sihir & Perjudian (Gambling)', 
                    value: 
                        '`!toss <jumlah>`  — Coffin Toss, koin naga berhadiah x2 (Snitch/Bludger).\n' +
                        '`!slot <jumlah>`  — Mesin Slot Gringotts, putar gulungan animasi & jackpot!'
                },
                { 
                    name: '👑 Admin / Lord Command', 
                    value: 
                        '`!sortinghat`     — Memanggil The Sorting Hat (khusus Owner).\n' +
                        '`!setlevel`       — Memanipulasi tingkat sihir (khusus Owner).\n' +
                        '`!givepoint`      — Memberikan berkah poin asrama (khusus Owner).'
                }
            )
            .setTimestamp()
            .setFooter({ text: 'Hogwarts Academy Magic System', iconURL: client.user.displayAvatarURL() });

        return message.channel.send({ embeds: [helpEmbed] });
    }

    // B. ADMIN COMMANDS (Khusus Lord / Owner Server)
    if (command === '!setlevel') {
        if (!isOwner) return message.reply('❌ Hanya Lord yang berhak memanipulasi tingkat sihir!');
        const targetUser = message.mentions.users.first();
        const newLevel = parseInt(args[2]);

        if (!targetUser || isNaN(newLevel)) return message.reply('🔮 **Format Salah!** Gunakan: `!setlevel @User <angka_level>`');
        if (targetUser.id === OWNER_ID) return message.reply('👑 Level Lord sudah dikunci permanen di puncak tertinggi!');

        let userDoc = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });
        if (!userDoc) {
            userDoc = new User({ userId: targetUser.id, guildId: message.guild.id, xp: 0, level: 1, galleons: 0 });
        }

        userDoc.level = Math.min(newLevel, 1000); 
        userDoc.xp = 0; 
        await userDoc.save();

        message.reply(`✅ Berhasil mengubah tingkat sihir ${targetUser} menjadi **Level ${userDoc.level}**!`);
        return;
    }

    if (command === '!givepoint') {
        if (!isOwner) return message.reply('❌ Hanya Lord yang bisa memberikan berkah poin asrama!');
        const targetMember = message.mentions.members.first();
        const points = parseInt(args[2]);

        if (!targetMember || isNaN(points)) return message.reply('🔮 **Format Salah!** Gunakan: `!givepoint @User <jumlah_poin>`');

        const targetHouse = HOUSES_DATA.find(h => targetMember.roles.cache.has(h.id));
        if (!targetHouse) return message.reply('❌ Penyihir tersebut belum bergabung dengan asrama Hogwarts mana pun!');

        housePointsCacheUpdate(targetHouse.name, points);

        return message.reply(`🏆 **+${points.toLocaleString()} Poin** telah dianugerahkan ke asrama **${targetHouse.emoji} ${targetHouse.name}** berkat prestasi ${targetMember}!`);
    }

    if (command === '!levelup') {
        if (!isOwner) return message.reply('❌ Perintah ini khusus untuk Lord of Magic!');
        const testEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle('✨ Hogwarts Academy Level Up!')
            .setDescription(`Selamat! ${message.author} telah naik level! 🎓`)
            .setTimestamp();

        await levelUpChannel.send({ embeds: [testEmbed] });
        return; 
    }

    if (command === '!sortinghat') {
        if (!isOwner) return message.reply('❌ Hanya Lord of Magic yang berhak memanggil The Sorting Hat!');

        const embed = new EmbedBuilder()
            .setColor(EMBED_COLOR) 
            .setTitle('The Sorting Hat')
            .setDescription('Welcome to **Hogwarts Academy**\n\nSilahkan tekan tombol di bawah dan biarkan Sorting Hat menentukan kelasmu!');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('sorting_hat').setLabel('Mencari Kelas').setEmoji('🎩').setStyle(ButtonStyle.Success)
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        return;
    }

    // Blokir command umum jika belum mendapat role kelas asrama
    if (!isSorted && !isOwner) {
        if (['!profile', '!leaderboard', '!student', '!absen', '!cash', '!send', '!toss', '!slot'].some(cmd => command.startsWith(cmd))) {
            const blockedEmbed = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setTitle('❌ Akses Ditolak!')
                .setDescription('Perintah ini hanya boleh digunakan oleh murid yang sudah memiliki Role Asrama / Kelas (Lewat The Sorting Hat). Silakan hubungi Lord of Magic!')
                .setTimestamp();
            return message.channel.send({ embeds: [blockedEmbed] });
        }
    }

    // C. CURRENCY SYSTEM (Absen, Cash, Send)
    if (command === '!absen') {
        try {
            let userDoc = await User.findOne({ userId, guildId: message.guild.id });
            if (!userDoc) {
                userDoc = new User({ userId, guildId: message.guild.id, xp: 0, level: 1, galleons: 0 });
            }

            const cooldownTime = 24 * 60 * 60 * 1000; 
            if (userDoc.lastAbsen && (Date.now() - userDoc.lastAbsen.getTime()) < cooldownTime) {
                const remainingTime = cooldownTime - (Date.now() - userDoc.lastAbsen.getTime());
                const hours = Math.floor(remainingTime / (60 * 60 * 1000));
                const minutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));
                
                const waitEmbed = new EmbedBuilder()
                    .setColor(EMBED_COLOR)
                    .setTitle('⏳ Batas Waktu Absen')
                    .setDescription(`Tunggu **${hours} jam ${minutes} menit** lagi sebelum bisa mengambil tunjangan harianmu kembali!`)
                    .setTimestamp();
                return message.channel.send({ embeds: [waitEmbed] });
            }

            function getAbsenXp() {
                const rand = Math.random();
                if (rand < 0.75) {
                    return Math.floor(Math.random() * 20) + 1;
                } else {
                    return Math.floor(Math.random() * 30) + 21;
                }
            }

            function getAbsenGalleons() {
                const rand = Math.random();
                if (rand < 0.75) {
                    return Math.floor(Math.random() * 801) + 400;
                } else {
                    return Math.floor(Math.random() * 800) + 1201;
                }
            }

            const xpGained = getAbsenXp();
            const galleonsGained = getAbsenGalleons();

            userDoc.xp += xpGained;
            userDoc.galleons = (userDoc.galleons || 0) + galleonsGained;
            userDoc.lastAbsen = new Date();

            let xpNeeded = getXpNeededForNextLevel(userDoc.level);
            let levelUpOccurred = false;

            while (userDoc.xp >= xpNeeded) {
                userDoc.xp -= xpNeeded;
                userDoc.level += 1;
                xpNeeded = getXpNeededForNextLevel(userDoc.level);
                levelUpOccurred = true;
                if (userDoc.level >= 1000) {
                    userDoc.level = 1000;
                    userDoc.xp = 0;
                    break;
                }
            }

            await userDoc.save();

            let descText = `Absen harian berhasil! Kamu mendapatkan tunjangan sihir:\n\n⭐ **+${xpGained} XP**\n🪙 **+${galleonsGained.toLocaleString()} Galleons**`;
            if (levelUpOccurred) {
                descText += `\n\n🎉 Selamat, tingkat sihirmu naik ke **Level ${userDoc.level}**!`;
            }

            const absenEmbed = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setTitle('📜 Absen Harian Akademik')
                .setDescription(descText)
                .setTimestamp();
            return message.channel.send({ embeds: [absenEmbed] });

        } catch (err) {
            console.error('Error saat memproses !absen:', err);
        }
    }

    if (command === '!cash') {
        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!userDoc) {
            userDoc = new User({ userId, guildId: message.guild.id, xp: 0, level: 1, galleons: 0 });
            await userDoc.save();
        }

        const cashEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle(`💰 Dompet Sihir — ${message.author.username.toUpperCase()}`)
            .setDescription(`Saldo tabunganmu saat ini adalah:\n\n🪙 **${(userDoc.galleons || 0).toLocaleString()} Galleons**\n\n🏰 Pundi-pundi Asrama: **${(userDoc.houseVault || 0).toLocaleString()} G**`)
            .setTimestamp();
        return message.channel.send({ embeds: [cashEmbed] });
    }

    if (command === '!send') {
        const targetUser = message.mentions.users.first();
        const sendAmount = parseInt(args[2]);

        if (!targetUser || isNaN(sendAmount) || sendAmount <= 0) {
            const formatSendEmbed = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setTitle('🔮 Format Pengiriman Galleon Salah')
                .setDescription('Gunakan format yang benar:\n`!send @User <jumlah_galleon>`\n*(Contoh: `!send @Harry 50`)*')
                .setTimestamp();
            return message.channel.send({ embeds: [formatSendEmbed] });
        }

        if (targetUser.bot) {
            const botSendEmbed = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setTitle('❌ Transaksi Ditolak')
                .setDescription('Kamu tidak bisa mengirim Galleon kepada bot sihir!')
                .setTimestamp();
            return message.channel.send({ embeds: [botSendEmbed] });
        }

        if (targetUser.id === userId) {
            const selfSendEmbed = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setTitle('❌ Transaksi Ditolak')
                .setDescription('Kamu tidak bisa mengirim Galleon kepada diri sendiri!')
                .setTimestamp();
            return message.channel.send({ embeds: [selfSendEmbed] });
        }

        let senderDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!senderDoc || (senderDoc.galleons || 0) < sendAmount) {
            const poorEmbed = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setTitle('🪙 Saldo Tidak Cukup')
                .setDescription(`Tabungan Galleon kamu tidak mencukupi untuk melakukan transaksi sebesar **${sendAmount.toLocaleString()} G**.\nSaldo saat ini: **${(senderDoc ? senderDoc.galleons : 0).toLocaleString()} G**`)
                .setTimestamp();
            return message.channel.send({ embeds: [poorEmbed] });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_send').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancel_send').setLabel('Cancel').setStyle(ButtonStyle.Danger)
        );

        const verifyEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle('⚖️ Verifikasi Pengiriman Galleon')
            .setDescription(`Apakah kamu yakin ingin mengirim **${sendAmount.toLocaleString()} Galleons** kepada ${targetUser}?`)
            .setTimestamp();

        const verifyMsg = await message.channel.send({ embeds: [verifyEmbed], components: [row] });

        const filter = i => i.user.id === userId;
        const collector = verifyMsg.createMessageComponentCollector({ filter, time: 30000 });

        collector.on('collect', async i => {
            if (i.customId === 'confirm_send') {
                senderDoc.galleons -= sendAmount;
                await senderDoc.save();

                let receiverDoc = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });
                if (!receiverDoc) {
                    receiverDoc = new User({ userId: targetUser.id, guildId: message.guild.id, xp: 0, level: 1, galleons: 0 });
                }
                receiverDoc.galleons = (receiverDoc.galleons || 0) + sendAmount;
                await receiverDoc.save();

                const successEmbed = new EmbedBuilder()
                    .setColor(EMBED_COLOR)
                    .setTitle('✅ Transaksi Berhasil')
                    .setDescription(`Berhasil mengirim **${sendAmount.toLocaleString()} Galleons** kepada ${targetUser}!`)
                    .setTimestamp();
                await i.update({ embeds: [successEmbed], components: [] });
            } else if (i.customId === 'cancel_send') {
                const cancelEmbed = new EmbedBuilder()
                    .setColor(EMBED_COLOR)
                    .setTitle('❌ Transaksi Dibatalkan')
                    .setDescription('Pengiriman Galleons dibatalkan oleh pengirim.')
                    .setTimestamp();
                await i.update({ embeds: [cancelEmbed], components: [] });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor(EMBED_COLOR)
                    .setTitle('⏰ Waktu Verifikasi Habis')
                    .setDescription('Verifikasi transaksi pengiriman Galleons telah kedaluwarsa.')
                    .setTimestamp();
                verifyMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(console.error);
            }
        });
        return;
    }

    // ==========================================
    // MINI-GAMES CASINO SIHIR (Toss & Slot)
    // ==========================================
    if (command === '!toss') {
        const betAmount = parseInt(args[1]);

        if (isNaN(betAmount) || betAmount <= 0) {
            const formatToss = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setTitle('🔮 Format Coffin Toss Salah')
                .setDescription('Gunakan format:\n`!toss <jumlah_galleon>`\n*(Contoh: `!toss 100`)*')
                .setTimestamp();
            return message.channel.send({ embeds: [formatToss] });
        }

        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!userDoc || (userDoc.galleons || 0) < betAmount) {
            const poorToss = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setTitle('🪙 Saldo Tidak Cukup')
                .setDescription(`Tabungan Galleon kamu tidak mencukupi untuk bertaruh sebesar **${betAmount.toLocaleString()} G**.\nSaldo saat ini: **${(userDoc ? userDoc.galleons : 0).toLocaleString()} G**`)
                .setTimestamp();
            return message.channel.send({ embeds: [poorToss] });
        }

        const tossRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('toss_snitch').setLabel('Snitch Emas').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('toss_bludger').setLabel('Bludger').setStyle(ButtonStyle.Danger)
        );

        const tossEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle('🎲 Coffin Toss - Lempar Koin Naga')
            .setDescription(`Taruhan: **${betAmount.toLocaleString()} Galleons**\n\nSilakan pilih sisi koin lemparanmu di bawah ini:`)
            .setTimestamp();

        const tossMsg = await message.channel.send({ embeds: [tossEmbed], components: [tossRow] });

        const filter = i => i.user.id === userId;
        const collector = tossMsg.createMessageComponentCollector({ filter, time: 30000 });

        collector.on('collect', async i => {
            const choices = ['snitch', 'bludger'];
            const botChoice = choices[Math.floor(Math.random() * choices.length)];
            
            const playerPick = i.customId === 'toss_snitch' ? 'snitch' : 'bludger';
            
            let resultDesc = `Koin naga berputar...\nKoin mendarat pada sisi: **${botChoice === 'snitch' ? '🟡 Snitch Emas' : '🔴 Bludger'}**\n\n`;

            if (playerPick === botChoice) {
                userDoc.galleons += betAmount; 
                await userDoc.save();
                resultDesc += `🎉 **Kemenangan Hebat!** Tebakanmu tepat. Saldo Galleon bertambah **+${betAmount.toLocaleString()} G**!`;
            } else {
                userDoc.galleons -= betAmount; 
                await userDoc.save();
                resultDesc += `❌ **Sayang Sekali!** Tebakanmu meleset. Saldo Galleon terpotong **-${betAmount.toLocaleString()} G**!`;
            }

            const resultEmbed = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setTitle('✨ Hasil Coffin Toss Sihir')
                .setDescription(resultDesc)
                .setTimestamp();

            await i.update({ embeds: [resultEmbed], components: [] });
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor(EMBED_COLOR)
                    .setTitle('⏰ Waktu Taruhan Habis')
                    .setDescription('Permainan Coffin Toss dibatalkan karena tidak ada respons pilihan.')
                    .setTimestamp();
                tossMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(console.error);
            }
        });
        return;
    }

    if (command === '!slot') {
        const betAmount = parseInt(args[1]);

        if (isNaN(betAmount) || betAmount <= 0) {
            const formatSlot = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setTitle('🔮 Format Mesin Slot Salah')
                .setDescription('Gunakan format:\n`!slot <jumlah_galleon>`\n*(Contoh: `!slot 50`)*')
                .setTimestamp();
            return message.channel.send({ embeds: [formatSlot] });
        }

        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!userDoc || (userDoc.galleons || 0) < betAmount) {
            const poorSlot = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setTitle('🪙 Saldo Tidak Cukup')
                .setDescription(`Tabungan Galleon kamu tidak mencukupi untuk bermain slot sebesar **${betAmount.toLocaleString()} G**.\nSaldo saat ini: **${(userDoc ? userDoc.galleons : 0).toLocaleString()} G**`)
                .setTimestamp();
            return message.channel.send({ embeds: [poorSlot] });
        }

        // Tampilan Animasi Rolling Awal Estetik
        const createSlotEmbed = (s1, s2, s3, text) => {
            return new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setTitle('🎰 Gringotts Vault - Mesin Slot Sihir')
                .setDescription(`Taruhan: **${betAmount.toLocaleString()} Galleons**\n\n**[  ${s1}  |  ${s2}  |  ${s3}  ]**\n\n${text}`)
                .setTimestamp();
        };

        const slotMsg = await message.channel.send({ 
            embeds: [createSlotEmbed('🌀', '🌀', '🌀', '*Mantra gulungan mesin slot mulai berputar...* 🌀')] 
        });

        // Menentukan Hasil Akhir dan Jackpot (Probabilitas)
        const rollRng = Math.random();
        const items = ['🏺', '🧹', '🎩', '🪙'];
        let rolled1, rolled2, rolled3;
        let multiplier = 0;

        if (rollRng < 0.75) {
            // 75% Gagal (Gambar Beda Semua)
            rolled1 = items[Math.floor(Math.random() * items.length)];
            do { rolled2 = items[Math.floor(Math.random() * items.length)]; } while (rolled2 === rolled1);
            do { rolled3 = items[Math.floor(Math.random() * items.length)]; } while (rolled3 === rolled1 || rolled3 === rolled2);
        } else if (rollRng < 0.87) { rolled1 = '🏺'; rolled2 = '🏺'; rolled3 = '🏺'; multiplier = 5; } // 12% Kuali (x5)
        else if (rollRng < 0.92) { rolled1 = '🧹'; rolled2 = '🧹'; rolled3 = '🧹'; multiplier = 10; } // 5% Sapu (x10)
        else if (rollRng < 0.94) { rolled1 = '🎩'; rolled2 = '🎩'; rolled3 = '🎩'; multiplier = 15; } // 2% Topi (x15)
        else { rolled1 = '🪙'; rolled2 = '🪙'; rolled3 = '🪙'; multiplier = 30; } // 1% Jackpot (x30)

        // Urutan Animasi Berhenti (Edit Beruntun Bertahap)
        setTimeout(() => {
            slotMsg.edit({ 
                embeds: [createSlotEmbed(rolled1, '🌀', '🌀', '*Slot pertama terkunci...* 🔒')] 
            });
        }, 1200);

        setTimeout(() => {
            slotMsg.edit({ 
                embeds: [createSlotEmbed(rolled1, rolled2, '🌀', '*Slot kedua terkunci...* 🔒')] 
            });
        }, 2400);

        setTimeout(async () => {
            if (multiplier > 0) {
                userDoc.galleons += (betAmount * multiplier) - betAmount;
                await userDoc.save();
            } else {
                userDoc.galleons -= betAmount;
                userDoc.houseVault = (userDoc.houseVault || 0) + betAmount; // Masuk ke Kas Asrama
                await userDoc.save();
            }

            let resultText = '';
            if (multiplier > 0) {
                resultText = `🎉 **JACKPOT (x${multiplier})!** Selamat, murid yang luar biasa! Kamu memenangkan **+${(betAmount * multiplier).toLocaleString()} Galleons**!`;
            } else {
                resultText = `💸 Zonk! Gulungan tidak ada yang kembar.\nTaruhan hangus dan berhasil disetorkan ke **Pundi-pundi Kas Asrama**!`;
            }

            slotMsg.edit({ 
                embeds: [createSlotEmbed(rolled1, rolled2, rolled3, resultText)] 
            });
        }, 3600); 

        return;
    }

    // D. GENERAL MAGICAL COMMANDS (Profile, Leaderboard, Student)
    if (command === '!profile') {
        const targetUser = message.mentions.users.first() || message.author;
        const targetMember = message.guild.members.cache.get(targetUser.id);
        
        if (!targetMember) {
            return message.reply('❌ Terjadi kesalahan: Penyihir tidak ditemukan di dalam cache server ini. Coba lagi nanti.');
        }

        let userLevel, userXp, xpNeeded, wizardTitle;
        let pointsContributed = 0; 
        let userGalleons = 0;

        if (targetUser.id === OWNER_ID) {
            userLevel = 9999;
            userXp = 0; 
            xpNeeded = getXpNeededForNextLevel(userLevel); 
            wizardTitle = 'Lord of Magic';
            
            let ownerDoc = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });
            userGalleons = ownerDoc ? (ownerDoc.galleons || 0) : 999999;
        } else {
            let userDoc = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });
            if (!userDoc) {
                userDoc = new User({ userId: targetUser.id, guildId: message.guild.id, xp: 0, level: 1, galleons: 0 });
                await userDoc.save();
            }
            
            userLevel = userDoc.level;
            userXp = userDoc.xp;
            xpNeeded = getXpNeededForNextLevel(userLevel);
            wizardTitle = getWizardTitle(userLevel, targetUser.id);
            userGalleons = userDoc.galleons || 0;
        }
        
        const targetHouse = HOUSES_DATA.find(h => targetMember.roles.cache.has(h.id));
        const houseName = targetHouse ? `${targetHouse.emoji} \`${targetHouse.name}\`` : 'Belum Masuk Asrama';

        const progressPercentage = targetUser.id === OWNER_ID ? 100 : Math.min(Math.floor((userXp / xpNeeded) * 100), 100);
        
        const totalBlocks = 15;
        const filledBlocks = Math.floor((progressPercentage / 100) * totalBlocks);
        const emptyBlocks = totalBlocks - filledBlocks;
        const visualBar = '▓'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

        const profileEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setAuthor({ 
                name: `✨ WIZARD PROFILE — ${targetUser.username.toUpperCase()} ✨`, 
                iconURL: targetUser.displayAvatarURL({ dynamic: true }) 
            })
            .setDescription('Selamat datang di **Hogwarts Academy Magic System** 🏰✨')
            .addFields(
                { name: '🧙‍♂️ Nama Penyihir', value: `\`${targetUser.username}\``, inline: true },
                { name: '🏷️ Gelar Sihir', value: `\`${wizardTitle}\``, inline: true },
                { name: '🏰 Asrama Hogwarts', value: `${houseName}`, inline: true },
                { name: '⭐ Level Saat Ini', value: `\`${userLevel}\``, inline: true },
                { name: '🏆 Poin Kontribusi', value: `\`${pointsContributed.toLocaleString()} Poin\``, inline: true },
                { name: '🪙 Saldo Tabungan', value: `\`${userGalleons.toLocaleString()} Galleons\``, inline: true },
                { name: '\u200B', value: '\u200B' }, 
                { 
                    name: `📈 Progress Menuju Level Berikutnya (${progressPercentage}%)`, 
                    value: `\`[${visualBar}]\`\n⚡ **${userXp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP**` 
                }
            )
            .setTimestamp()
            .setFooter({ text: 'Hogwarts Academy Magic System', iconURL: client.user.displayAvatarURL() });

        await message.channel.send({ embeds: [profileEmbed] });
        return;
    }

    if (command === '!leaderboard') {
        const sortedHouses = Object.entries(housePointsCache).sort((a, b) => b[1] - a[1]);

        const lbEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR) 
            .setTitle('🏆 House Cup Tournament - Leaderboard')
            .setDescription('Klasemen asrama Hogwarts saat ini:\n\n' + sortedHouses.map((house, index) => {
                const houseMeta = HOUSES_DATA.find(h => h.name === house[0]);
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📜';
                return `${medal} **Rank ${index + 1}**: ${houseMeta.emoji} **${house[0]}** — \`${house[1].toLocaleString()} Poin\``;
            }).join('\n'))
            .setTimestamp();

        return message.channel.send({ embeds: [lbEmbed] });
    }

    if (command === '!student') {
        await message.guild.members.fetch();

        const embed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle('🎓 Hogwarts Academy Student Roster')
            .setDescription('Daftar seluruh murid aktif yang telah dikelompokkan ke asrama masing-masing.')
            .setTimestamp()
            .setFooter({ text: 'Hogwarts Academy Roster System', iconURL: client.user.displayAvatarURL() });

        for (const house of HOUSES_DATA) {
            const membersInHouse = message.guild.members.cache.filter(member => 
                member.roles.cache.has(house.id) && !member.user.bot
            );

            let houseList = '';
            if (membersInHouse.size === 0) {
                houseList = '*(Belum ada murid di asrama ini)*';
            } else {
                let counter = 1;
                houseList = membersInHouse.map(member => {
                    const name = member.displayName;
                    const item = `${house.emoji} **${name}**`;
                    counter++;
                    return item;
                }).join('\n');
            }

            embed.addFields({
                name: '\u200B',
                value: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${house.emoji} **${house.name.toUpperCase()}** (${membersInHouse.size} Murid)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${houseList}`,
                inline: false
            });
        }

        await message.channel.send({ embeds: [embed] });
        return;
    }

    // AUTOMATIC XP SYSTEM (Chat Text - 15 XP Flat)
    if (userId !== OWNER_ID && !xpCooldowns.has(userId)) {
        try {
            let userDoc = await User.findOne({ userId, guildId: message.guild.id });
            if (!userDoc) {
                userDoc = new User({ userId, guildId: message.guild.id, xp: 0, level: 1, galleons: 0 });
            }

            if (userDoc.level >= 1000) return;

            const xpGained = 15;
            userDoc.xp += xpGained;

            if (userHouseObj) {
                houseCacheUpdate(userHouseObj.name, 1);
            }

            let xpNeeded = getXpNeededForNextLevel(userDoc.level);
            let levelUpOccurred = false;
            let reachedLevelCheckpoint = false;

            while (userDoc.xp >= xpNeeded) {
                userDoc.xp -= xpNeeded; 
                userDoc.level += 1; 
                xpNeeded = getXpNeededForNextLevel(userDoc.level);
                levelUpOccurred = true;

                if (userDoc.level % 5 === 0) {
                    reachedLevelCheckpoint = true;
                }

                if (userDoc.level >= 1000) {
                    userDoc.level = 1000;
                    userDoc.xp = 0;
                    break;
                }
            }

            if (levelUpOccurred && reachedLevelCheckpoint) {
                const newTitle = getWizardTitle(userDoc.level, userId);
                const levelUpEmbed = new EmbedBuilder()
                    .setColor(EMBED_COLOR) 
                    .setTitle('✨ Hogwarts Academy Milestone!')
                    .setDescription(`Selamat! <@${userId}> telah mencapai **Level ${userDoc.level}** dan kini bergelar **${newTitle}**! 🎓 Pencapaian yang luar biasa!`)
                    .setTimestamp();

                await levelUpChannel.send({ embeds: [levelUpEmbed] });
            }

            await userDoc.save();
            
            xpCooldowns.add(userId);
            setTimeout(() => xpCooldowns.delete(userId), 60000);

        } catch (err) {
            console.error('Masalah saat memproses XP Chat:', err);
        }
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'sorting_hat') return;

    const member = interaction.member;
    const alreadySorted = HOUSES_DATA.some(house => member.roles.cache.has(house.id));

    if (alreadySorted) {
        return interaction.reply({ content: '🎩 You have already been sorted into a House!', ephemeral: true });
    }

    const randomHouse = HOUSES_DATA[Math.floor(Math.random() * HOUSES_DATA.length)];
    await member.roles.add(randomHouse.id);

    await interaction.reply({ content: `🎩 The Sorting Hat has chosen...\n\n${randomHouse.emoji} ${randomHouse.name}!`, ephemeral: true });
});

function housePointsCacheUpdate(houseName, points) {
    housePointsCache[houseName] = (housePointsCache[houseName] || 0) + points;
}

function houseCacheUpdate(houseName, points) {
    housePointsCache[houseName] = (housePointsCache[houseName] || 0) + points;
}

client.login(process.env.DISCORD_TOKEN);