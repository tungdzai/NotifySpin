const axios = require('axios');
const tough = require('tough-cookie');
const {wrapper} = require('axios-cookiejar-support');
const fs = require('fs');
const express = require('express');
const {Server} = require('ws');
const app = express();
const PORT = process.env.PORT || 8080;
app.use(express.static('public'));

const TelegramBot = require('node-telegram-bot-api');
const token = '7326539177:AAFr4OUgIUVx6xijFr8BByIlNr7rHtEeexQ';
const telegramBot = new TelegramBot(token);
const chatId = '1958068409';

async function sendTelegramMessage(message) {
    try {
        await telegramBot.sendMessage(chatId, message);
    } catch (error) {
        console.error("Lỗi gửi tin nhắn đến Telegram:", error);
    }
}

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
const wss = new Server({server});
let validDataList = [];
let checkAllGiftStatus = '';
wss.on('connection', (ws) => {
    console.log('Client connected');

    if (validDataList.length > 0) {
        ws.send(JSON.stringify({type: 'validDataList', data: validDataList}));
    }
    if (checkAllGiftStatus) {
        ws.send(JSON.stringify({type: 'status', data: checkAllGiftStatus}));
    }

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});


function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function authLogin(token, retries = 2) {
    if (retries < 0) {
        return null;
    } else if (retries < 2) {
        await delay(2000);
    }
    try {
        const jar = new tough.CookieJar();
        const client = wrapper(axios.create({jar}));
        const urlLogin = `https://var.fconline.garena.vn/auth/login/callback?access_token=${token}`;
        await client.get(urlLogin, {
            headers: {
                'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Sec-Fetch-Site': 'cross-site',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-User': '?1',
                'Sec-Fetch-Dest': 'document',
                'host': 'var.fconline.garena.vn'
            }
        });
        const cookies = await jar.getCookies(urlLogin);
        const sessionCookie = cookies.find(cookie => cookie.key === 'session');
        const sessionSigCookie = cookies.find(cookie => cookie.key === 'session.sig');
        if (sessionCookie && sessionSigCookie) {
            const session = sessionCookie.value;
            const sessionSig = sessionSigCookie.value;
            const cookieString = `session=${session}; session.sig=${sessionSig}`;
            return cookieString;
        } else {
            const message = `Không thể lấy session`
            await sendTelegramMessage(message);
        }
    } catch (error) {
        const message = `Lỗi xác thực:=${error.response.status}`
        console.error(message)
        return await authLogin(token, retries - 1);
    }
}

async function getInfo(cookie, retries = 3) {
    if (retries < 0) {
        return null;
    } else if (retries < 3) {
        await delay(2000);
    }
    try {
        const jar = new tough.CookieJar();
        const client = wrapper(axios.create({jar}));
        const urlGetPlayer = "https://var.fconline.garena.vn/api/player/get";
        const response = await client.get(urlGetPlayer, {
            headers: {
                'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
                'Accept': 'application/json, text/plain, */*',
                'sec-ch-ua-mobile': '?0',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'sec-ch-ua-platform': '"Windows"',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'host': 'var.fconline.garena.vn',
                'Cookie': cookie
            }
        });
        return response.data;
    } catch (error) {
        const message = `Lỗi lấy thông tin người chơi: ${error.response.status}`;
        console.error(message);
        return await getInfo(cookie, retries - 1);
    }
}

async function spin(cookie, retries = 2) {
    if (retries < 0) {
        return null;
    }
    if (retries < 2) {
        await delay(2000);
    }
    try {
        const jar = new tough.CookieJar();
        const client = wrapper(axios.create({jar}));
        const urlSpin = "https://var.fconline.garena.vn/api/lucky-draw-rewards/spin";
        const response = await client.post(urlSpin, {"usePoint": true}, {
            headers: {
                'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
                'Accept': 'application/json, text/plain, */*',
                'sec-ch-ua-mobile': '?0',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'sec-ch-ua-platform': '"Windows"',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'host': 'var.fconline.garena.vn',
                'Cookie': cookie
            }
        })
        return response.data
    } catch (error) {
        const message = `Lỗi spin: ${error.response.status}`
        await sendTelegramMessage(message);
        return await spin(cookie, retries - 1);
    }

}

async function readTokensFromFile(filename) {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, 'utf8', (err, data) => {
            if (err) {
                return reject(err);
            }
            const tokens = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            resolve(tokens);
        });
    });
}

async function spinRewards() {
    const listTokens = await readTokensFromFile('data.txt');
    for (const token of listTokens) {
        const cookie = await authLogin(token);
        if (cookie) {
            const dataPlayer = await getInfo(cookie);
            if (dataPlayer) {
                const pointPlayer = dataPlayer.player.point;
                const totalSpin = Math.floor(pointPlayer / 10000);
                console.log(totalSpin)
                if (totalSpin >0){
                    for (let i = 0; i < totalSpin; i++) {
                        const responseSpin = await spin(cookie);
                        if (responseSpin) {
                            const message = `Trúng thưởng: ${responseSpin.spinnedReward.name}-${responseSpin.spinnedReward.type}-${responseSpin.spinnedReward.giftCode}-${responseSpin.spinnedReward.shopeeCode}`;
                            console.log(message)
                            const idBP = responseSpin.spinnedReward.id;
                            if (idBP !== 13) {
                                const message = `Trúng thưởng: ${responseSpin.spinnedReward.name}-${responseSpin.spinnedReward.type}-${responseSpin.spinnedReward.giftCode}-${responseSpin.spinnedReward.shopeeCode}`;
                                await sendTelegramMessage(message);
                            }
                        }
                        await delay(35000);
                    }
                }else {
                    const message = `Tài khoản không đủ điểm để quay`;
                    await sendTelegramMessage(message);
                }
            } else {
                const message = `Không thể lấy thông tin người chưa của token: ${token}`;
                await sendTelegramMessage(message);
            }
        } else {
            const message = `Không thể lấy cookie của token: ${token}`;
            await sendTelegramMessage(message);
        }
    }
}

spinRewards().catch(async (error) => {
    const message = `Lỗi trong lần chạy đầu tiên: ${error.message}`;
    await sendTelegramMessage(message);
});

