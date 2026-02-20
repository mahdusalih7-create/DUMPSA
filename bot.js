const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const axios = require('axios');

// رابط الـ API الخاص بالـ Lua Dumper
const API_URL = 'https://dumpsa-production.up.railway.app/api/dump';

// التوكن يتم أخذه من Environment Variable
const TOKEN = process.env.TOKEN; 
if (!TOKEN) {
    console.error("❌ يرجى تعيين توكن البوت في Environment Variable باسم TOKEN");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log('✅ البوت شغال: ' + client.user.tag);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!help') {
        return message.reply(
            '**🤖 اوامر البوت:**\n' +
            '1️⃣ ارسل ملف `.lua` مع `!deobf`\n' +
            '2️⃣ ارسل كود Lua داخل ```lua\n' +
            '3️⃣ ارسل رابط `.lua`'
        );
    }

    if (message.content.startsWith('!deobf')) {
        let code = '';
        let loadMsg = await message.reply('⏳ جاري المعالجة...');

        try {
            // حالة الملف المرفق
            if (message.attachments.size > 0) {
                const file = message.attachments.first();
                const res = await axios.get(file.url);
                code = res.data;

            // حالة الكود المباشر داخل ```lua
            } else {
                const match = message.content.match(/```(?:lua)?\n?([\s\S]+?)```/);
                if (match) code = match[1];
            }

            if (!code) return loadMsg.edit('❌ لم يتم العثور على كود!');

            // إرسال الكود للـ API
            const result = await axios.post(API_URL, { code });
            if (!result.data.success) return loadMsg.edit('❌ فشل فك التشفير');

            const output = result.data.dumpedCode;

            if (output.length < 1800) {
                await loadMsg.edit('✅ تم فك التشفير:\n```lua\n' + output + '\n```');
            } else {
                const buffer = Buffer.from(output, 'utf8');
                const attachment = new AttachmentBuilder(buffer, { name: 'deobfuscated.lua' });
                await loadMsg.delete();
                await message.reply({ content: '✅ **تم فك التشفير**', files: [attachment] });
            }

        } catch (err) {
            console.error(err);
            await loadMsg.edit('❌ حدث خطأ، حاول مرة ثانية');
        }
    }
});

client.login(TOKEN);
