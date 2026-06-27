require('dotenv').config();
const mongoose = require('mongoose');
const {
    Client,
    GatewayIntentBits,
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ComponentType
} = require('discord.js');

// Mengambil model User (Pastikan folder models dan file User.js ada di server)
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
// KONFIGURASI HOGWARTS & CACHE
// ==========================================
const OWNER_ID = '1180180812327559310'; 
// Fallback aman jika process.env gagal terbaca di hosting
const LEVEL_UP_CHANNEL_ID = process.env.LEVELUP_CHANNEL_ID || '1475801714425860272'; 
const EMBED_COLOR = '#25a5cf'; 
const MAX_BET_LIMIT = 500000; 

const HOUSES_DATA = [
    { id: '1475605712938864796', name: 'Gryffindor', emoji: '🦁', command: 'gryffindor' },
    { id: '1475786100210401413', name: 'Slytherin', emoji: '🐍', command: 'slytherin' },
    { id: '1475786808167235604', name: 'Ravenclaw', emoji: '🦅', command: 'ravenclaw' },
    { id: '1475787032759631965', name: 'Hufflepuff', emoji: '🦡', command: 'hufflepuff' }
];

const SHOP_ITEMS = [
    // Slide 1: Ramuan / Potion
    { id: 'potion_felix', name: 'Felix Felicis (Ramuan Hoki)', type: 'potion', rarity: 'epic', price: 15000, desc: 'Meningkatkan hoki judi 10% selama 1 jam.' },
    { id: 'potion_poly', name: 'Polyjuice Potion', type: 'potion', rarity: 'rare', price: 8000, desc: 'Ramuan penyamaran misterius.' },
    // Slide 2: Titles / Gelar
    { id: 'title_duelist', name: 'Title: Apprentice Duelist', type: 'title', rarity: 'common', price: 5000, titleText: 'Apprentice Duelist', desc: 'Gelar petarung sihir pemula.' },
    { id: 'title_animagus', name: 'Title: Animagus', type: 'title', rarity: 'rare', price: 25000, titleText: 'Animagus', desc: 'Gelar penyihir perubahan bentuk.' },
    { id: 'title_archmage', name: 'Title: Archmage', type: 'title', rarity: 'legendary', price: 200000, titleText: 'Archmage', desc: 'Gelar penyihir tingkat tinggi.' },
    // Slide 3: Makanan Pet
    { id: 'food_basic', name: 'Biji Labu Ajaib (Pakan Pet)', type: 'food', rarity: 'common', price: 100, desc: 'Makanan pokok untuk peliharaan.' },
    { id: 'food_premium', name: 'Daging Sapi Unicorn (Pakan Pet)', type: 'food', rarity: 'rare', price: 1200, desc: 'Makanan lezat penambah kesetiaan.' },
    // Slide 4: Pet Shop
    { id: 'pet_rat', name: 'Pet: Rat (Common)', type: 'pet', rarity: 'common', price: 2000, desc: 'Peliharaan tikus kecil yang penurut.' },
    { id: 'pet_toad', name: 'Pet: Toad (Common)', type: 'pet', rarity: 'common', price: 2500, desc: 'Katak peliharaan yang sering melompat.' },
    { id: 'pet_kneazle', name: 'Pet: Kneazle (Uncommon)', type: 'pet', rarity: 'uncommon', price: 7500, desc: 'Kucing hutan cerdas kerabat kneazle.' },
    { id: 'pet_hippogriff', name: 'Pet: Hippogriff (Rare)', type: 'pet', rarity: 'rare', price: 35000, desc: 'Kuda elang peliharaan yang sangat bangga.' },
    { id: 'pet_dragon', name: 'Pet: Dragon Cub (Epic)', type: 'pet', rarity: 'epic', price: 100000, desc: 'Anak naga api kecil yang mengagumkan.' },
    { id: 'pet_phoenix', name: 'Pet: Phoenix (Legendary)', type: 'pet', rarity: 'legendary', price: 500000, desc: 'Burung api legendaris yang abadi.' }
];

let activeShopStock = [];
const gamblingCooldowns = new Map();
const xpCooldowns = new Set();

let housePointsCache = {
    'Gryffindor': 0,
    'Slytherin': 0,
    'Ravenclaw': 0,
    'Hufflepuff': 0
};

// ==========================================
// KALKULASI LEVEL
// ==========================================
function getXpNeededForNextLevel(level) {
    if (level >= 9999) return 999999;
    if (level < 500) return level * 25;
    return level * 65;
}

function getTotalXpRequirement(targetLevel) {
    let total = 0;
    for (let l = 1; l < targetLevel; l++) {
        total += getXpNeededForNextLevel(l);
    }
    return total;
}

async function migrateUserLevel(userDoc) {
    const currentTotalXp = (userDoc.level ? getTotalXpRequirement(userDoc.level) : 0) + (userDoc.xp || 0);
    
    let newLevel = 1;
    let remainingXp = currentTotalXp;
    
    while (true) {
        const needed = getXpNeededForNextLevel(newLevel);
        if (remainingXp >= needed) {
            remainingXp -= needed;
            newLevel++;
            if (newLevel >= 1000) {
                newLevel = 1000;
                remainingXp = 0;
                break;
            }
        } else {
            break;
        }
    }
    
    userDoc.level = newLevel;
    userDoc.xp = remainingXp;
    await userDoc.save();
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

function generateRandomStock() {
    activeShopStock = [];
    
    SHOP_ITEMS.forEach(item => {
        let maxStock = 0;
        const roll = Math.random() * 100;

        if (item.rarity === 'common') {
            if (roll < 70) maxStock = Math.floor(Math.random() * 7) + 1;
        } else if (item.rarity === 'uncommon') {
            if (roll < 40) maxStock = Math.floor(Math.random() * 5) + 1;
        } else if (item.rarity === 'rare') {
            if (roll < 15) maxStock = Math.floor(Math.random() * 4) + 1;
        } else if (item.rarity === 'epic') {
            if (roll < 5) maxStock = Math.floor(Math.random() * 3) + 1;
        } else if (item.rarity === 'legendary') {
            if (roll < 1) maxStock = 1;
        }

        if (maxStock > 0) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let uniqueCode = '';
            for (let i = 0; i < 6; i++) {
                uniqueCode += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            activeShopStock.push({
                ...item,
                stockCode: uniqueCode,
                stock: maxStock
            });
        }
    });
    console.log(`🛒 Toko Sihir Di-reset. Total Item Global Tersedia: ${activeShopStock.length}`);
}

// ==========================================
// KONEKSI DATABASE & INISIALISASI
// ==========================================
const dbUrl = process.env.MONGO_URL || process.env.MONGODB_URI;
if (!dbUrl) {
    console.error("❌ PENTING: MONGODB_URI atau MONGO_URL belum diset di Variable Environment hostinganmu!");
}

mongoose.connect(dbUrl)
.then(async () => {
    console.log('🔗 Connected to MongoDB Database successfully!');
    
    try {
        const allUsers = await User.find({});
        for (let u of allUsers) {
            await migrateUserLevel(u);
        }
        console.log('✅ Penyesuaian level murid ke sistem baru selesai dimigrasi!');
    } catch (migErr) {
        console.error('❌ Gagal menjalankan migrasi level (diabaikan jika database kosong):', migErr.message);
    }

    generateRandomStock();
    setInterval(generateRandomStock, 3600000);

    const token = process.env.DISCORD_TOKEN;
    if (!token) {
        console.error("❌ PENTING: DISCORD_TOKEN belum diset di Variable Environment hostinganmu!");
    } else {
        client.login(token);
    }
}).catch(err => {
    console.error('❌ Failed to connect to MongoDB:', err);
});

client.once(Events.ClientReady, () => {
    console.log(`✨ Logged in as ${client.user.tag} — System online! ✨`);

    // Voice State Loop
    setInterval(async () => {
        try {
            const guilds = client.guilds.cache;
            for (const [guildId, guild] of guilds) {
                if (!guild.voiceStates) continue;
                guild.voiceStates.cache.forEach(async (voiceState) => {
                    const userId = voiceState.id;

                    if (voiceState.channelId && !voiceState.member.user.bot && userId !== OWNER_ID) {
                        let userDoc = await User.findOne({ userId, guildId: guild.id });
                        if (!userDoc) {
                            userDoc = new User({ userId, guildId: guild.id, xp: 0, level: 1, galleons: 0 });
                        }

                        if (userDoc.level >= 1000) return;

                        userDoc.xp += 30;

                        const userHouseObj = HOUSES_DATA.find(h => voiceState.member.roles.cache.has(h.id));
                        if (userHouseObj) {
                            housePointsCache[userHouseObj.name] = (housePointsCache[userHouseObj.name] || 0) + 1;
                        }

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

                        if (levelUpOccurred && userDoc.level % 5 === 0) {
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
    }, 150000); 
});

// ==========================================
// MESSAGECREATE - SISTEM UTAMA & COMMAND
// ==========================================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const args = message.content.split(' ');
    const command = args[0].toLowerCase();

    const userHouseObj = HOUSES_DATA.find(h => message.member.roles.cache.has(h.id));
    const isOwner = userId === OWNER_ID;

    const checkAndSetCooldown = async (cmdName) => {
        if (isOwner) return false;
        const now = Date.now();
        const cooldownAmount = 10000; 
        const timestamps = gamblingCooldowns.get(cmdName);

        if (timestamps && timestamps.has(userId)) {
            const expirationTime = timestamps.get(userId) + cooldownAmount;
            if (now < expirationTime) {
                let secondsLeft = Math.ceil((expirationTime - now) / 1000);
                const cdMsg = await message.reply(`⏳ Tahan tongkat sihirmu! Harap tunggu **${secondsLeft} detik** lagi.`);

                const interval = setInterval(() => {
                    secondsLeft -= 1;
                    if (secondsLeft > 0) {
                        cdMsg.edit(`⏳ Tahan tongkat sihirmu! Harap tunggu **${secondsLeft} detik** lagi.`).catch(() => {});
                    }
                }, 1000);

                setTimeout(() => {
                    clearInterval(interval);
                    cdMsg.delete().catch(() => {});
                }, cooldownAmount);

                return true; 
            }
        }
        
        if (!timestamps) {
            gamblingCooldowns.set(cmdName, new Map());
        }
        gamblingCooldowns.get(cmdName).set(userId, now);
        setTimeout(() => gamblingCooldowns.get(cmdName).delete(userId), cooldownAmount);
        return false;
    };

    if (command === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle('📜 Hogwarts Academy - Command Directory')
            .setDescription('Berikut adalah daftar mantra (*command*) yang dapat kamu gunakan di akademi sihir ini:')
            .addFields(
                { name: '🏰 Akademik', value: '`!profile`\n`!student`\n`!leaderboard`' },
                { name: '🪙 Keuangan', value: '`!absen`\n`!cash`\n`!send`' },
                { name: '🛒 Toko & Inventaris', value: '`!shop`\n`!title`\n`!equiptitle <kode>`\n`!pet`\n`!petequip <kode>`\n`!feedpet`' },
                { name: '🎲 Kasino Sihir', value: '`!toss`\n`!slot`\n`!gobs`\n`!snap`\n`!snitch`' }
            )
            .setTimestamp();
        return message.channel.send({ embeds: [helpEmbed] });
    }

    if (command === '!absen') {
        if (userId === OWNER_ID) return message.reply('Owner tidak bisa absen.');
        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!userDoc) userDoc = new User({ userId, guildId: message.guild.id, xp: 0, level: 1, galleons: 0 });

        const now = new Date();
        if (userDoc.lastAbsen && now.toDateString() === userDoc.lastAbsen.toDateString()) {
            return message.reply('⏳ Anda sudah melakukan absen hari ini. Silakan coba lagi besok!');
        }

        const bonusGalleons = 500;
        userDoc.galleons += bonusGalleons;
        userDoc.lastAbsen = now;
        await userDoc.save();

        const embed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle('✨ Absen Harian Diterima')
            .setDescription(`Selamat, kamu mendapatkan **+${bonusGalleons.toLocaleString()} Galleons** sebagai uang saku harian akademis!`);
        return message.channel.send({ embeds: [embed] });
    }

    if (command === '!cash') {
        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        const galleons = userDoc ? userDoc.galleons || 0 : 0;
        const embed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle('🪙 Pundi-pundi Galleon')
            .setDescription(`Saldo dompet sihirmu saat ini adalah **${galleons.toLocaleString()} Galleons**.`);
        return message.channel.send({ embeds: [embed] });
    }

    if (command === '!send') {
        const targetUser = message.mentions.users.first();
        const amount = parseInt(args[2]);

        if (!targetUser || isNaN(amount) || amount <= 0) {
            return message.reply('🔮 Format salah. Gunakan: `!send @User <jumlah>`');
        }

        if (targetUser.bot || targetUser.id === userId) {
            return message.reply('❌ Tidak dapat mengirim Galleon ke diri sendiri atau bot.');
        }

        let senderDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!senderDoc || (senderDoc.galleons || 0) < amount) {
            return message.reply('🪙 Galleons di ranselmu tidak mencukupi untuk melakukan transfer ini.');
        }

        let receiverDoc = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });
        if (!receiverDoc) {
            receiverDoc = new User({ userId: targetUser.id, guildId: message.guild.id, xp: 0, level: 1, galleons: 0 });
        }

        senderDoc.galleons -= amount;
        receiverDoc.galleons += amount;

        await senderDoc.save();
        await receiverDoc.save();

        return message.reply(`✅ Berhasil mengirim **${amount.toLocaleString()} Galleons** kepada <@${targetUser.id}>.`);
    }

    if (command === '!shop') {
        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!userDoc) {
            userDoc = new User({ userId, guildId: message.guild.id, xp: 0, level: 1, galleons: 0 });
            await userDoc.save();
        }

        let currentSlide = 1;
        const maxSlides = 4;

        const generateShopEmbed = (slide) => {
            const embed = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setTimestamp()
                .setFooter({ text: `Hogwarts Magic Shop (Refresh dalam 1 Jam) | Saldo: ${userDoc.galleons.toLocaleString()} G` });

            if (slide === 1) {
                embed.setTitle('🛒 Potion / Ramuan Sihir (Slide 1/4)');
                embed.setDescription('Ramuan-ramuan sihir untuk meningkatkan kemampuanmu.');
                const potions = activeShopStock.filter(i => i.type === 'potion');
                if (potions.length === 0) embed.addFields({ name: 'Stok Kosong', value: 'Belum ada ramuan yang tersedia saat ini.' });
                potions.forEach(p => {
                    embed.addFields({ name: `[${p.rarity.toUpperCase()}] ${p.name} — *Stok: ${p.stock}*`, value: `${p.desc}\n💰 Harga: **${p.price.toLocaleString()} G** | Kode: \`${p.stockCode}\`` });
                });
            } else if (slide === 2) {
                embed.setTitle('📜 Title / Gelar Sihir (Slide 2/4)');
                embed.setDescription('Gunakan gelar (*title*) untuk memperindah profilmu.');
                const titles = activeShopStock.filter(i => i.type === 'title');
                if (titles.length === 0) embed.addFields({ name: 'Stok Kosong', value: 'Tidak ada gelar sihir yang dijual saat ini.' });
                titles.forEach(t => {
                    embed.addFields({ name: `[${t.rarity.toUpperCase()}] ${t.name} — *Stok: ${t.stock}*`, value: `${t.desc}\n💰 Harga: **${t.price.toLocaleString()} G** | Kode: \`${t.stockCode}\`` });
                });
            } else if (slide === 3) {
                embed.setTitle('🍗 Makanan Peliharaan / Pet Food (Slide 3/4)');
                embed.setDescription('Berikan nutrisi untuk hewan peliharaanmu agar semakin setia.');
                const foods = activeShopStock.filter(i => i.type === 'food');
                if (foods.length === 0) embed.addFields({ name: 'Stok Kosong', value: 'Tidak ada makanan saat ini.' });
                foods.forEach(f => {
                    embed.addFields({ name: `[${f.rarity.toUpperCase()}] ${f.name} — *Stok: ${f.stock}*`, value: `${f.desc}\n💰 Harga: **${f.price.toLocaleString()} G** | Kode: \`${f.stockCode}\`` });
                });
            } else if (slide === 4) {
                embed.setTitle('🐾 Peliharaan / Pet Shop (Slide 4/4)');
                embed.setDescription('Adopsi hewan pendamping sihirmu di sini.');
                const pets = activeShopStock.filter(i => i.type === 'pet');
                if (pets.length === 0) embed.addFields({ name: 'Stok Kosong', value: 'Peti hewan peliharaan sedang kosong.' });
                pets.forEach(pet => {
                    embed.addFields({ name: `[${pet.rarity.toUpperCase()}] ${pet.name} — *Stok: ${pet.stock}*`, value: `${pet.desc}\n💰 Harga: **${pet.price.toLocaleString()} G** | Kode: \`${pet.stockCode}\`` });
                });
            }
            return embed;
        };

        const getNavRows = (slide) => {
            const rowUpper = new ActionRowBuilder();
            if (slide === 1) {
                rowUpper.addComponents(new ButtonBuilder().setCustomId('next_slide').setLabel('Next (Slide 2) ➡️').setStyle(ButtonStyle.Primary));
            } else if (slide === 2) {
                rowUpper.addComponents(
                    new ButtonBuilder().setCustomId('prev_slide').setLabel('⬅️ Prev (Slide 1)').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('next_slide').setLabel('Next (Slide 3) ➡️').setStyle(ButtonStyle.Primary)
                );
            } else if (slide === 3) {
                rowUpper.addComponents(
                    new ButtonBuilder().setCustomId('prev_slide').setLabel('⬅️ Prev (Slide 2)').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('next_slide').setLabel('Next (Slide 4) ➡️').setStyle(ButtonStyle.Primary)
                );
            } else if (slide === 4) {
                rowUpper.addComponents(new ButtonBuilder().setCustomId('prev_slide').setLabel('⬅️ Prev (Slide 3)').setStyle(ButtonStyle.Primary));
            }

            const rowLower = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('buy_panel').setLabel('Beli Item').setStyle(ButtonStyle.Success)
            );

            return [rowUpper, rowLower];
        };

        const shopMsg = await message.channel.send({ embeds: [generateShopEmbed(currentSlide)], components: getNavRows(currentSlide) });

        const collector = shopMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) return i.reply({ content: '❌ Anda tidak memiliki akses ke panel ini.', ephemeral: true });

            if (i.customId === 'next_slide' && currentSlide < maxSlides) {
                currentSlide++;
                await i.update({ embeds: [generateShopEmbed(currentSlide)], components: getNavRows(currentSlide) });
            } else if (i.customId === 'prev_slide' && currentSlide > 1) {
                currentSlide--;
                await i.update({ embeds: [generateShopEmbed(currentSlide)], components: getNavRows(currentSlide) });
            } else if (i.customId === 'buy_panel') {
                const panel2Embed = new EmbedBuilder()
                    .setColor(EMBED_COLOR)
                    .setTitle('🛒 Panel Pembelian - Masukkan Kode Item')
                    .setDescription('Silakan balas lewat chat dalam **15 detik** dengan format: `!shopcode <kode_item>` untuk melanjutkan transaksi.')
                    .setTimestamp();

                const backRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('back_to_shop').setLabel('⬅️ Kembali ke Toko').setStyle(ButtonStyle.Primary)
                );

                await i.update({ embeds: [panel2Embed], components: [backRow] });
            } else if (i.customId === 'back_to_shop') {
                await i.update({ embeds: [generateShopEmbed(currentSlide)], components: getNavRows(currentSlide) });
            }
        });

        collector.on('end', () => {
            shopMsg.edit({ components: [] }).catch(() => {});
        });
        return;
    }

    if (command.startsWith('!shopcode')) {
        const inputCode = args[1];
        if (!inputCode) return message.reply('🔮 Masukkan format kode: `!shopcode <kode_item>`');

        const itemObj = activeShopStock.find(it => it.stockCode === inputCode.toUpperCase());
        if (!itemObj) return message.reply('❌ Kode item tidak ditemukan atau sudah kedaluwarsa/habis terjual.');

        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!userDoc) userDoc = new User({ userId, guildId: message.guild.id, xp: 0, level: 1, galleons: 0 });

        const buyEmbedPanel = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle(`⚖️ Kuantitas Pembelian — ${itemObj.name}`)
            .setDescription(`Harga Satuan: **${itemObj.price.toLocaleString()} G**\nStok Tersisa: **${itemObj.stock}**\n\nPilih jumlah yang ingin dibeli:`)
            .setTimestamp();

        const countRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`buy_qty_1_${itemObj.stockCode}`).setLabel('1').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`buy_qty_5_${itemObj.stockCode}`).setLabel('5').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`buy_qty_10_${itemObj.stockCode}`).setLabel('10').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`buy_qty_all_${itemObj.stockCode}`).setLabel('ALL').setStyle(ButtonStyle.Secondary)
        );

        const backRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('back_to_shop_panel').setLabel('⬅️ Back').setStyle(ButtonStyle.Primary)
        );

        const verifyMsg = await message.channel.send({ embeds: [buyEmbedPanel], components: [countRow, backRow] });

        const collector = verifyMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) return i.reply({ content: '❌ Akses ditolak.', ephemeral: true });

            if (i.customId.startsWith('buy_qty_') || i.customId === 'back_to_shop_panel') {
                if (i.customId === 'back_to_shop_panel') {
                    return i.update({ content: 'Kembali, silahkan ketik `!shop` untuk membuka toko.', embeds: [], components: [] });
                }

                const parts = i.customId.split('_');
                const qtyStr = parts[2]; 
                const code = parts[3];

                const refItem = activeShopStock.find(it => it.stockCode === code);
                let qty = 0;

                if (qtyStr === '1') qty = 1;
                else if (qtyStr === '5') qty = 5;
                else if (qtyStr === '10') qty = 10;
                else if (qtyStr === 'all') qty = refItem.stock;

                if (qty > refItem.stock) qty = refItem.stock;

                const totalPrice = refItem.price * qty;

                if (userDoc.galleons < totalPrice) {
                    return i.reply({ content: `🪙 **Galleons tidak cukup!** Total harga untuk ${qty} item adalah ${totalPrice.toLocaleString()} G.`, ephemeral: true });
                }

                const finalEmbed = new EmbedBuilder()
                    .setColor(EMBED_COLOR)
                    .setTitle('💳 Konfirmasi Pembayaran')
                    .setDescription(`Item: **${refItem.name}**\nJumlah: **${qty}**\nTotal Bayar: **${totalPrice.toLocaleString()} G**\n\nLanjutkan Pembelian?`)
                    .setTimestamp();

                const confirmActionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`confirm_buy_${code}_${qty}`).setLabel('Buy').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('cancel_buy').setLabel('Cancel').setStyle(ButtonStyle.Danger)
                );

                await i.update({ embeds: [finalEmbed], components: [confirmActionRow] });
            } else if (i.customId === 'cancel_buy') {
                await verifyMsg.delete().catch(() => {});
                const cancelEmbed = new EmbedBuilder().setColor(EMBED_COLOR).setTitle('❌ Transaksi Dibatalkan').setDescription('Pesan verifikasi & transaksi dibatalkan.');
                return message.channel.send({ embeds: [cancelEmbed] });
            } else if (i.customId.startsWith('confirm_buy_')) {
                const parts = i.customId.split('_');
                const code = parts[2];
                const qty = parseInt(parts[3]);

                const refItem = activeShopStock.find(it => it.stockCode === code);
                const totalPrice = refItem.price * qty;

                userDoc.galleons -= totalPrice;
                refItem.stock -= qty;
                
                if (refItem.type === 'potion') {
                    userDoc.potions = userDoc.potions || [];
                    userDoc.potions.push({ id: refItem.id, name: refItem.name });
                } else if (refItem.type === 'title') {
                    userDoc.titles = userDoc.titles || [];
                    userDoc.titles.push({ id: refItem.id, name: refItem.titleText, code: refItem.stockCode });
                } else if (refItem.type === 'food') {
                    userDoc.foods = userDoc.foods || [];
                    userDoc.foods.push({ id: refItem.id, name: refItem.name, count: qty });
                } else if (refItem.type === 'pet') {
                    userDoc.pets = userDoc.pets || [];
                    userDoc.pets.push({ id: refItem.id, name: refItem.name, code: refItem.stockCode, rarity: refItem.rarity, fed: 0 });
                }

                await userDoc.save();
                if (refItem.stock <= 0) {
                    activeShopStock = activeShopStock.filter(it => it.stockCode !== code);
                }

                await verifyMsg.delete().catch(() => {});
                const successEmbed = new EmbedBuilder().setColor(EMBED_COLOR).setTitle('✅ Transaksi Berhasil').setDescription(`Berhasil membeli ${qty} ${refItem.name}.`);
                return message.channel.send({ embeds: [successEmbed] });
            }
        });
        collector.on('end', () => { verifyMsg.delete().catch(() => {}); });
        return;
    }

    if (command === '!title') {
        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!userDoc || !userDoc.titles || userDoc.titles.length === 0) {
            return message.reply('❌ Kamu belum memiliki title/gelar apa pun. Beli di `!shop` terlebih dahulu!');
        }
        
        let desc = 'Berikut adalah title/gelar yang kamu miliki:\n\n';
        userDoc.titles.forEach((t, idx) => {
            desc += `${idx + 1}. **${t.name}** — Kode: \`${t.code}\`\n`;
        });
        desc += '\n*Gunakan: `!equiptitle <kode>` untuk memakai gelar.*';

        const embed = new EmbedBuilder().setColor(EMBED_COLOR).setTitle('📜 Daftar Gelar Sihir Anda').setDescription(desc);
        return message.channel.send({ embeds: [embed] });
    }

    if (command === '!equiptitle') {
        const code = args[1];
        if (!code) return message.reply('🔮 Gunakan: `!equiptitle <kode_title>`');

        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!userDoc || !userDoc.titles) return message.reply('❌ Kamu tidak memiliki gelar tersebut.');

        const targetTitle = userDoc.titles.find(t => t.code === code.toUpperCase());
        if (!targetTitle) return message.reply('❌ Kode gelar sihir tidak valid atau tidak ada di inventaris title Anda.');

        userDoc.equippedTitle = targetTitle.name;
        await userDoc.save();

        return message.reply(`✅ Berhasil memasang gelar **${targetTitle.name}** pada jubah sihirmu!`);
    }

    if (command === '!pet') {
        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!userDoc || !userDoc.pets || userDoc.pets.length === 0) {
            return message.reply('🐾 Kamu belum memiliki hewan peliharaan (*pet*). Silakan adopsi lewat `!shop`!');
        }

        let desc = 'Berikut daftar peliharaan yang kamu adopsi:\n\n';
        userDoc.pets.forEach((p, idx) => {
            const equippedStatus = userDoc.equippedPetCode === p.code ? '🟢 (Sedang Dipakai)' : '';
            desc += `${idx + 1}. ${p.name} (Rarity: **${p.rarity.toUpperCase()}**) — Kode: \`${p.code}\` ${equippedStatus}\n`;
        });
        desc += '\n*Gunakan `!petequip <kode>` untuk membawa peliharaanmu.*';

        const embed = new EmbedBuilder().setColor(EMBED_COLOR).setTitle('Канданг Peliharaan Anda').setDescription(desc);
        return message.channel.send({ embeds: [embed] });
    }

    if (command === '!petequip') {
        const code = args[1];
        if (!code) return message.reply('🔮 Gunakan format: `!petequip <kode_pet>`');

        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!userDoc || !userDoc.pets) return message.reply('❌ Kamu belum memiliki hewan peliharaan.');

        const targetPet = userDoc.pets.find(p => p.code === code.toUpperCase());
        if (!targetPet) return message.reply('❌ Kode pet tidak valid / tidak ada dalam ransel peliharaanmu.');

        userDoc.equippedPetCode = targetPet.code;
        userDoc.equippedPetName = targetPet.name;
        await userDoc.save();

        return message.reply(`🪄 Berhasil memanggil dan memakai peliharaan: **${targetPet.name}**!`);
    }

    if (command === '!feedpet') {
        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!userDoc || !userDoc.pets || userDoc.pets.length === 0) {
            return message.reply('❌ Kamu belum memiliki hewan peliharaan untuk diberi makan.');
        }

        if (!userDoc.foods || userDoc.foods.length === 0) {
            return message.reply('🍗 Ransel makananmu kosong! Silakan beli makanan pet di `!shop` terlebih dahulu.');
        }

        const embedPet = new EmbedBuilder().setColor(EMBED_COLOR).setTitle('🐾 Pilih Peliharaan').setDescription('Pilih hewan peliharaan mana yang ingin kamu beri makan:');
        const rowPet = new ActionRowBuilder();
        userDoc.pets.forEach((p, idx) => {
            rowPet.addComponents(new ButtonBuilder().setCustomId(`feed_pet_${idx}`).setLabel(p.name).setStyle(ButtonStyle.Primary));
        });

        const msg = await message.channel.send({ embeds: [embedPet], components: [rowPet] });

        const filter = i => i.user.id === userId;
        const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

        let selectedPetIndex = null;

        collector.on('collect', async i => {
            if (i.customId.startsWith('feed_pet_')) {
                selectedPetIndex = parseInt(i.customId.split('_')[2]);
                
                const embedFood = new EmbedBuilder().setColor(EMBED_COLOR).setTitle('🍗 Pilih Jenis Makanan').setDescription('Pilih pakan untuk peliharaanmu:');
                const rowFood = new ActionRowBuilder();
                userDoc.foods.forEach((f, idx) => {
                    rowFood.addComponents(new ButtonBuilder().setCustomId(`feed_food_${idx}`).setLabel(f.name).setStyle(ButtonStyle.Success));
                });
                rowFood.addComponents(new ButtonBuilder().setCustomId('close_feed').setLabel('Close').setStyle(ButtonStyle.Danger));

                await i.update({ embeds: [embedFood], components: [rowFood] });
            } else if (i.customId.startsWith('feed_food_')) {
                const foodIndex = parseInt(i.customId.split('_')[2]);
                const foodItem = userDoc.foods[foodIndex];

                const embedQty = new EmbedBuilder().setColor(EMBED_COLOR).setTitle('✨ Tentukan Kuantitas Makan').setDescription(`Beri makan **${foodItem.name}** sebanyak apa?`);
                const rowQty = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`feed_act_1_${selectedPetIndex}_${foodIndex}`).setLabel('Feed 1x').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`feed_act_5_${selectedPetIndex}_${foodIndex}`).setLabel('x5').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`feed_act_10_${selectedPetIndex}_${foodIndex}`).setLabel('x10').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('close_feed').setLabel('Close').setStyle(ButtonStyle.Danger)
                );

                await i.update({ embeds: [embedQty], components: [rowQty] });
            } else if (i.customId.startsWith('feed_act_')) {
                const parts = i.customId.split('_');
                const qty = parseInt(parts[2]);
                const pIdx = parseInt(parts[3]);
                const fIdx = parseInt(parts[4]);

                const fItem = userDoc.foods[fIdx];
                if (fItem.count < qty) {
                    return i.reply({ content: `❌ Stok makanan **${fItem.name}** tidak cukup untuk jumlah tersebut!`, ephemeral: true });
                }

                fItem.count -= qty;
                if (fItem.count <= 0) {
                    userDoc.foods = userDoc.foods.filter((_, idx) => idx !== fIdx);
                }

                userDoc.pets[pIdx].fed = (userDoc.pets[pIdx].fed || 0) + qty;
                await userDoc.save();

                await msg.delete().catch(() => {});
                return message.channel.send({ embeds: [new EmbedBuilder().setColor(EMBED_COLOR).setTitle('✅ Sukses Memberi Makan').setDescription(`Peliharaan **${userDoc.pets[pIdx].name}** telah diberi makan sebanyak **${qty} kali**.`)] });
            } else if (i.customId === 'close_feed') {
                await msg.delete().catch(() => {});
            }
        });
        return;
    }

    if (command === '!toss') {
        const betAmount = parseInt(args[1]);
        if (isNaN(betAmount) || betAmount <= 0) return message.channel.send({ embeds: [new EmbedBuilder().setColor(EMBED_COLOR).setTitle('🔮 Format Coffin Toss Salah').setDescription('Gunakan: `!toss <jumlah>`')] });
        const isCooldown = await checkAndSetCooldown('toss');
        if (isCooldown) return;
        if (betAmount > MAX_BET_LIMIT) return message.channel.send({ embeds: [new EmbedBuilder().setColor(EMBED_COLOR).setTitle('⚠️ Batas Taruhan').setDescription(`Max: **${MAX_BET_LIMIT.toLocaleString()}**`)] });

        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!userDoc || (userDoc.galleons || 0) < betAmount) return message.channel.send({ embeds: [new EmbedBuilder().setColor(EMBED_COLOR).setTitle('🪙 Saldo Kurang').setDescription('Galleons tidak cukup.')] });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('toss_snitch').setLabel('Snitch').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('toss_bludger').setLabel('Bludger').setStyle(ButtonStyle.Secondary)
        );
        const msg = await message.channel.send({ embeds: [new EmbedBuilder().setColor(EMBED_COLOR).setTitle('🎲 Coffin Toss').setDescription('Pilih sisi koinmu!')], components: [row] });
        
        const collector = msg.createMessageComponentCollector({ time: 30000 });
        collector.on('collect', async i => {
            if (i.user.id !== userId) return;
            const choices = ['snitch', 'bludger'];
            const botC = choices[Math.floor(Math.random() * choices.length)];
            const win = (i.customId === `toss_${botC}`);
            
            if (win) userDoc.galleons += betAmount;
            else userDoc.galleons -= betAmount;
            await userDoc.save();
            
            await i.update({ embeds: [new EmbedBuilder().setColor(EMBED_COLOR).setDescription(`Koin mendarat pada: **${botC}**\n\n${win ? '🎉 Menang!' : '❌ Kalah!'}`)], components: [] });
        });
        return;
    }

    if (command === '!slot') {
        const betAmount = parseInt(args[1]);
        if (isNaN(betAmount) || betAmount <= 0) return message.channel.send({ embeds: [new EmbedBuilder().setColor(EMBED_COLOR).setTitle('🔮 Format Slot Salah').setDescription('Gunakan: `!slot <jumlah>`')] });
        const isCooldown = await checkAndSetCooldown('slot');
        if (isCooldown) return;

        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!userDoc || (userDoc.galleons || 0) < betAmount) return message.channel.send({ embeds: [new EmbedBuilder().setColor(EMBED_COLOR).setTitle('🪙 Saldo Kurang').setDescription('Galleons tidak cukup.')] });

        const createEmbed = (s1, s2, s3, txt) => new EmbedBuilder().setColor(EMBED_COLOR).setDescription(`**[ ${s1} | ${s2} | ${s3} ]**\n\n${txt}`);
        const msg = await message.channel.send({ embeds: [createEmbed('🌀','🌀','🌀','Mesin slot mulai berputar...')] });
        
        const items = ['🏺', '🧹', '🎩', '🪙'];
        const r = Math.random();
        let i1, i2, i3, mult = 0;
        
        if (r < 0.75) { i1 = items[0]; i2 = items[1]; i3 = items[2]; }
        else if (r < 0.87) { i1 = '🏺'; i2 = '🏺'; i3 = '🏺'; mult = 5; } 
        else if (r < 0.92) { i1 = '🧹'; i2 = '🧹'; i3 = '🧹'; mult = 10; } 
        else if (r < 0.94) { i1 = '🎩'; i2 = '🎩'; i3 = '🎩'; mult = 15; } 
        else { i1 = '🪙'; i2 = '🪙'; i3 = '🪙'; mult = 30; }

        setTimeout(() => msg.edit({ embeds: [createEmbed(i1, '🌀', '🌀', 'Slot 1 terkunci...')] }), 1200);
        setTimeout(() => msg.edit({ embeds: [createEmbed(i1, i2, '🌀', 'Slot 2 terkunci...')] }), 2400);
        setTimeout(async () => {
            if (mult > 0) userDoc.galleons += (betAmount * mult) - betAmount;
            else { userDoc.galleons -= betAmount; userDoc.houseVault = (userDoc.houseVault || 0) + betAmount; }
            await userDoc.save();
            msg.edit({ embeds: [createEmbed(i1, i2, i3, mult > 0 ? `🎉 Jackpot (x${mult})!` : '💸 Zonk!')] });
        }, 3600);
        return;
    }

    if (command === '!gobs') {
        const betAmount = parseInt(args[1]);
        if (isNaN(betAmount) || betAmount <= 0) return message.reply('Gunakan: `!gobs <jumlah>`');
        const isCooldown = await checkAndSetCooldown('gobs');
        if (isCooldown) return;

        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!userDoc || userDoc.galleons < betAmount) return message.reply('Galleon kurang.');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('gobs_besar').setLabel('Besar').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('gobs_kecil').setLabel('Kecil').setStyle(ButtonStyle.Secondary)
        );
        const msg = await message.channel.send({ embeds: [new EmbedBuilder().setColor(EMBED_COLOR).setTitle('🎲 Gobstones Risk').setDescription('Pilih Besar (8-12) atau Kecil (2-7)')], components: [row] });
        
        const c = msg.createMessageComponentCollector({ time: 30000 });
        c.on('collect', async i => {
            if (i.user.id !== userId) return;
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            const tot = d1 + d2;
            const actual = tot >= 8 ? 'besar' : 'kecil';
            const win = i.customId === `gobs_${actual}`;
            
            if (win) userDoc.galleons += betAmount;
            else { userDoc.galleons -= betAmount; userDoc.houseVault = (userDoc.houseVault || 0) + betAmount; }
            await userDoc.save();
            
            i.update({ embeds: [new EmbedBuilder().setDescription(`Total Dadu: **${tot}** (${d1} + ${d2})\n\n${win ? '🎉 Menang!' : '💥 Zonk!'}`)], components: [] });
        });
        return;
    }

    if (command === '!snap') {
        const betAmount = parseInt(args[1]);
        if (isNaN(betAmount) || betAmount <= 0) return message.reply('Gunakan: `!snap <jumlah>`');
        const isCooldown = await checkAndSetCooldown('snap');
        if (isCooldown) return;

        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!userDoc || userDoc.galleons < betAmount) return message.reply('Galleon kurang.');

        let p1 = Math.floor(Math.random() * 10) + 1, p2 = Math.floor(Math.random() * 10) + 1;
        let pCards = [p1, p2], pTotal = p1 + p2;
        let b1 = Math.floor(Math.random() * 10) + 1, b2 = Math.floor(Math.random() * 10) + 1;
        let bCards = [b1, b2], bTotal = b1 + b2;

        const runAI = () => {
            while (bTotal < 17 && Math.random() < 0.6) {
                bTotal += Math.floor(Math.random() * 10) + 1;
            }
        };

        const embed = () => new EmbedBuilder().setColor(EMBED_COLOR).setDescription(`**Kartu Anda:** [${pCards.join('][')}] (Total: **${pTotal}**)\n**Kartu Bot:** [${bCards[0]}][ ? ]`);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('snap_hit').setLabel('Hit').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('snap_open').setLabel('Open').setStyle(ButtonStyle.Danger)
        );
        const msg = await message.channel.send({ embeds: [embed()], components: [row] });
        
        const c = msg.createMessageComponentCollector({ time: 120000 });
        c.on('collect', async i => {
            if (i.user.id !== userId) return;
            if (i.customId === 'snap_hit') {
                pTotal += Math.floor(Math.random() * 10) + 1;
                pCards.push('⚡');
                if (pTotal > 21) {
                    c.stop(); runAI();
                    userDoc.galleons -= betAmount;
                    userDoc.houseVault = (userDoc.houseVault || 0) + betAmount;
                    await userDoc.save();
                    i.update({ embeds: [new EmbedBuilder().setDescription(`💥 BUST!\n\nAnda: ${pTotal} | Bot: ${bTotal}`)], components: [] });
                } else {
                    i.update({ embeds: [embed()], components: [row] });
                }
            } else if (i.customId === 'snap_open') {
                c.stop(); runAI();
                if (Math.random() < 0.35 ? (pTotal <= 21 && pTotal > bTotal) : false) {
                    userDoc.galleons += betAmount;
                } else {
                    userDoc.galleons -= betAmount; userDoc.houseVault = (userDoc.houseVault || 0) + betAmount;
                }
                await userDoc.save();
                i.update({ embeds: [new EmbedBuilder().setDescription(`Selesai.\n\nAnda: **${pTotal}** | Bot: **${bTotal}**`)], components: [] });
            }
        });
        return;
    }

    if (command === '!snitch') {
        const betAmount = parseInt(args[1]);
        if (isNaN(betAmount) || betAmount <= 0) return message.reply('Gunakan: `!snitch <jumlah>`');
        const isCooldown = await checkAndSetCooldown('snitch');
        if (isCooldown) return;

        let userDoc = await User.findOne({ userId, guildId: message.guild.id });
        if (!userDoc || userDoc.galleons < betAmount) return message.reply('Galleon kurang.');

        const rows = [
            new ActionRowBuilder().addComponents([1,2,3,4,5].map(n => new ButtonBuilder().setCustomId(`sn_${n}`).setLabel(n.toString()).setStyle(ButtonStyle.Secondary))),
            new ActionRowBuilder().addComponents([6,7,8,9,10].map(n => new ButtonBuilder().setCustomId(`sn_${n}`).setLabel(n.toString()).setStyle(ButtonStyle.Secondary)))
        ];
        const msg = await message.channel.send({ embeds: [new EmbedBuilder().setColor(EMBED_COLOR).setTitle('⚡ Golden Snitch Catch').setDescription('Pilih nomor keberuntungan (1-10):')], components: rows });
        
        const c = msg.createMessageComponentCollector({ time: 30000 });
        c.on('collect', async i => {
            const guess = parseInt(i.customId.split('_')[1]);
            const target = Math.floor(Math.random() * 10) + 1;
            
            if (guess === target) {
                userDoc.galleons += betAmount * 5;
                await userDoc.save();
                i.update({ embeds: [new EmbedBuilder().setDescription(`🏆 Jackpot! Angka **${target}** tepat.\n\nHadiah: +${(betAmount * 5).toLocaleString()}`)], components: [] });
            } else {
                userDoc.galleons -= betAmount;
                userDoc.houseVault = (userDoc.houseVault || 0) + betAmount;
                await userDoc.save();
                i.update({ embeds: [new EmbedBuilder().setDescription(`❌ Meleset! Snitch menghindar ke angka **${target}**.\n\nTaruhan hangus: -${betAmount.toLocaleString()}`)], components: [] });
            }
        });
        return;
    }

    if (command === '!profile') {
        const targetUser = message.mentions.users.first() || message.author;
        const targetMember = message.guild.members.cache.get(targetUser.id);
        
        if (!targetMember) return message.reply('❌ User tidak ditemukan.');

        let userLevel, userXp, xpNeeded, wizardTitle, userGalleons = 0;
        let equippedTitleText = 'Tidak ada gelar terpasang';
        let equippedPetText = 'Tidak ada peliharaan';

        if (targetUser.id === OWNER_ID) {
            userLevel = 9999; userXp = 0; xpNeeded = 100; wizardTitle = 'Lord of Magic'; userGalleons = 999999;
            equippedTitleText = 'Lord of Magic'; equippedPetText = 'Phoenix Legendaris';
        } else {
            let userDoc = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });
            if (!userDoc) {
                userDoc = new User({ userId: targetUser.id, guildId: message.guild.id, xp: 0, level: 1, galleons: 0 });
                await userDoc.save();
            }
            await migrateUserLevel(userDoc);
            
            userLevel = userDoc.level; userXp = userDoc.xp;
            xpNeeded = getXpNeededForNextLevel(userLevel);
            wizardTitle = getWizardTitle(userLevel, targetUser.id);
            userGalleons = userDoc.galleons || 0;
            equippedTitleText = userDoc.equippedTitle || 'Tidak ada gelar terpasang';
            equippedPetText = userDoc.equippedPetName || 'Tidak ada peliharaan';
        }
        
        const targetHouse = HOUSES_DATA.find(h => targetMember.roles.cache.has(h.id));
        const houseName = targetHouse ? `${targetHouse.emoji} \`${targetHouse.name}\`` : 'Belum Masuk Asrama';

        const progress = Math.min(Math.floor((userXp / xpNeeded) * 100), 100);
        const bar = '▓'.repeat(Math.floor((progress/100)*15)) + '░'.repeat(15 - Math.floor((progress/100)*15));

        const profileEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setAuthor({ name: `✨ WIZARD PROFILE — ${targetUser.username.toUpperCase()} ✨`, iconURL: targetUser.displayAvatarURL() })
            .addFields(
                { name: '🧙‍♂️ Nama', value: `\`${targetUser.username}\``, inline: true },
                { name: '🏷️ Gelar Sihir', value: `\`${wizardTitle}\``, inline: true },
                { name: '🏰 Asrama', value: houseName, inline: true },
                { name: '⭐ Level', value: `\`${userLevel}\``, inline: true },
                { name: '🪙 Galleons', value: `\`${userGalleons.toLocaleString()} G\``, inline: true },
                { name: '\u200B', value: '\u200B' },
                { name: '📜 Equipped Title', value: `\`${equippedTitleText}\``, inline: true },
                { name: '🐾 Peliharaan', value: `\`${equippedPetText}\``, inline: true },
                { name: '\u200B', value: '\u200B' },
                { name: `📈 Progress Level (${progress}%)`, value: `\`[${bar}]\` ⚡ **${userXp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP**` }
            )
            .setTimestamp();

        await message.channel.send({ embeds: [profileEmbed] });
        return;
    }

    if (userId !== OWNER_ID && !xpCooldowns.has(userId)) {
        try {
            let userDoc = await User.findOne({ userId, guildId: message.guild.id });
            if (!userDoc) userDoc = new User({ userId, guildId: message.guild.id, xp: 0, level: 1, galleons: 0 });

            if (userDoc.level >= 1000) return;

            userDoc.xp += 5;

            if (userHouseObj) {
                housePointsCache[userHouseObj.name] = (housePointsCache[userHouseObj.name] || 0) + 1;
            }

            let xpNeeded = getXpNeededForNextLevel(userDoc.level);
            let levelUpOccurred = false;

            while (userDoc.xp >= xpNeeded) {
                userDoc.xp -= xpNeeded; 
                userDoc.level += 1; 
                xpNeeded = getXpNeededForNextLevel(userDoc.level);
                levelUpOccurred = true;
                if (userDoc.level >= 1000) {
                    userDoc.level = 1000; userDoc.xp = 0; break;
                }
            }

            if (levelUpOccurred && userDoc.level % 5 === 0) {
                const newTitle = getWizardTitle(userDoc.level, userId);
                const levelUpEmbed = new EmbedBuilder()
                    .setColor(EMBED_COLOR)
                    .setTitle('✨ Hogwarts Academy Milestone!')
                    .setDescription(`Selamat! <@${userId}> telah mencapai **Level ${userDoc.level}** dan kini bergelar **${newTitle}**! 🎓 Pencapaian luar biasa!`)
                    .setTimestamp();
                
                const channel = message.guild.channels.cache.get(LEVEL_UP_CHANNEL_ID);
                if (channel) channel.send({ embeds: [levelUpEmbed] }).catch(() => {});
            }

            await userDoc.save();
            xpCooldowns.add(userId);
            setTimeout(() => xpCooldowns.delete(userId), 60000);
        } catch (err) {
            console.error('Error XP Chat:', err);
        }
    }
});

client.on(Events.GuildMemberRemove, async (guild) => {
    try {
        await User.deleteMany({ guildId: guild.id });
        console.log(`🧹 Semua data level dan ekonomi di-reset otomatis karena bot dikick dari server ${guild.name}.`);
    } catch (err) {
        console.error('Gagal menghapus data guild:', err);
    }
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('❌ Gagal melakukan login ke Discord Client:', err);
});