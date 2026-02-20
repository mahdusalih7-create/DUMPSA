const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const axios = require('axios');

const API_URL = 'https://dumpsa-production.up.railway.app/api/dump';
const TOKEN = 'MTQ3MjM1MTU5MjUwNTI4Mjc1OQ.Gtell4.W5o5OOtLxi9mZr9jikHgZE_eJeGHH0Y_Az9dL0';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageC

client.once('ready', () => {
    console.log('✅ البوت شغال: ' + client.user.tag);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // امر المساعدة
    if (message.content === '!help') {
        return message.reply(
            '**🤖 اوامر البوت:**\n\n' +
            '**1.** ارسل كود مباشر:\n' +
            '`!deobf` ثم الكود بين ` ``` `\n\n' +
            '**2.** ارسل رابط:\n' +
            '`!deobf https://رابط.lua`\n\n' +
            '**3.** ارسل ملف:\n' +
            'ارفع ملف `.lua` واكتب `!deobf`'
        );
    }

    // امر فك التشفير
    if (message.content.startsWith('!deobf')) {
        let code = '';
        let loadMsg = await message.reply('⏳ جاري المعالجة...');

        try {
            // حالة 1: رابط
            if (message.content.includes('http')) {
                const url = message.content.split(' ')[1];
                await loadMsg.edit('⏳ جاري تحميل الرابط...');
                const res = await axios.get(url, { timeout: 10000 });
                code = res.data;

            // حالة 2: ملف
            } else if (message.attachments.size > 0) {
                const file = message.attachments.first();
                if (!file.name.endsWith('.lua')) {
                    return loadMsg.edit('❌ الملف لازم يكون `.lua`');
                }
                await loadMsg.edit('⏳ جاري قراءة الملف...');
                const res = await axios.get(file.url);
                code = res.data;

            // حالة 3: كود مباشر
            } else {
                const match = message.content.match(/```(?:lua)?\n?([\s\S]+?)```/);
                if (match) code = match[1];
            }

            if (!code) {
                return loadMsg.edit(
                    '❌ ما لقيت كود!\n' +
                    'اكتب `!help` لمعرفة طريقة الاستخدام'
                );
            }

            await loadMsg.edit('🔄 جاري فك التشفير...');

            const result = await axios.post(
                API_URL,
                { code },
                { timeout: 30000 }
            );

            if (!result.data.success) {
                return loadMsg.edit('❌ فشل فك التشفير');
            }

            const output = result.data.dumpedCode;
            const stats = result.data.stats;

            const statsText = stats
                ? `\n📊 **الإحصائيات:** ${stats.totalLines} سطر | ${stats.remoteCalls} remote | ${stats.suspiciousStrings} string`
                : '';

            // اذا قصير
            if (output.length < 1800) {
                await loadMsg.edit(
                    '✅ **تم فك التشفير:**' + statsText + '\n' +
                    '```lua\n' + output + '\n```'
                );

            // اذا طويل ارسله كملف
            } else {
                const buffer = Buffer.from(output, 'utf8');
                const attachment = new AttachmentBuilder(buffer, {
                    name: 'deobfuscated.lua'
                });
                await loadMsg.delete();
                await message.reply({
                    content: '✅ **تم فك التشفير**' + statsText,
                    files: [attachment]
                });
            }

        } catch (err) {
            console.error(err);
            await loadMsg.edit('❌ صار خطأ، حاول مرة ثانية');
        }
    }
});

client.login(TOKEN);
