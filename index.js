// WhatsApp Group Transfer Tool - Heroku Deployable Version
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Keep Heroku awake (web dyno ke liye)
app.get('/', (req, res) => {
    res.send('WhatsApp Transfer Bot is running!');
});

app.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
});

// WhatsApp Client Configuration (Heroku ke liye important flags)
const client = new Client({
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    },
    authStrategy: new LocalAuth()
});

// QR Code Generate hoga to terminal mein dikhega
client.on('qr', (qr) => {
    console.log('📱 SCAN THIS QR CODE WITH WHATSAPP:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp Bot is READY!');
    console.log('Bot ab active hai. Commands ka wait kar raha hai...');
});

// Group members transfer karne ka function
async function transferMembers(sourceGroupId, targetGroupId, memberList) {
    try {
        const sourceGroup = await client.getChatById(sourceGroupId);
        const targetGroup = await client.getChatById(targetGroupId);
        
        // Agar member list nahi di to source group se nikaal
        if (!memberList || memberList.length === 0) {
            memberList = sourceGroup.participants.map(p => p.id._serialized);
            console.log(`📋 Source group se ${memberList.length} members mile`);
        }
        
        // Ek ek karke add karo (delay ke saath)
        for (let i = 0; i < memberList.length; i++) {
            try {
                await targetGroup.addParticipants([memberList[i]]);
                console.log(`✅ Added ${memberList[i]} (${i+1}/${memberList.length})`);
            } catch (err) {
                console.log(`❌ Failed to add ${memberList[i]}: ${err.message}`);
            }
            
            // 3 second delay (WhatsApp rate limit se bachne ke liye)
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        console.log(`🎉 Transfer complete! ${memberList.length} members processed.`);
    } catch (error) {
        console.error('Transfer error:', error);
    }
}

// Command handler
client.on('message', async (message) => {
    const body = message.body;
    const chat = await message.getChat();
    
    // Transfer command: !transfer <groupB_id> [member1,member2,...]
    if (body.startsWith('!transfer')) {
        const args = body.split(' ');
        const targetGroupId = args[1];
        
        if (!targetGroupId) {
            await message.reply('❌ Usage: !transfer <groupB_id> [optional: member_list]');
            return;
        }
        
        await message.reply(`🚀 Transfer starting to group: ${targetGroupId}`);
        
        // Current group (jahan se command aayi) ko source maano
        const sourceGroupId = chat.id._serialized;
        
        await transferMembers(sourceGroupId, targetGroupId, null);
        await message.reply('✅ Transfer complete!');
    }
    
    // Help command
    if (body === '!help') {
        await message.reply(`
🤖 WhatsApp Transfer Bot Commands:
!transfer <groupB_id> - Current group ke members ko Group B mein transfer karega
!status - Bot ki status check karo
!alive - Check if bot is running
        `);
    }
    
    // Status command
    if (body === '!status' || body === '!alive') {
        await message.reply('✅ Bot is active and running on Heroku!');
    }
});

// Error handling
client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
});

client.initialize();