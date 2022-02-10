import dotenv from 'dotenv'
import TelegramApi from 'node-telegram-bot-api';
import mainApi from './utils/api.js';

const sourcePath = '.env'

dotenv.config()

const token = process.env.TG_TOKEN;
const bot = new TelegramApi(token, {polling: true});

bot.on('message', msg => {
  let text = msg.text;
  const chatId = msg.chat.id;

  if (text == `/cs\@${process.env.TG_NAME}`) {
    text = '/cs';
  }

  if (text == `/cs2\@${process.env.TG_NAME}` || text === '/dj') {
    text = '/cs2';
  }

  if (text === '/cs' || text === '/cs2' || text === '/lin' || text === '/win') {
    let num;

    switch (text) {
      case '/cs':
        num = 1;
        break;

      case '/cs2':
        num = 2;
        break;

      case '/lin':
        num = 3;
        break;

      case '/win':
        num = 4;
        break;
    }

    mainApi.getInfo(num)
    .then((res) => {
      if (res?.error?.code == 401) {
        throw new Error('UNAUTHENTICATED');
      }
      if (findRes(res) !== undefined) {
        if (findRes(res).length > 0) {
          bot.sendMessage(chatId, `Сейчас в смене ${findRes(res).join(', ')}`)
        }
      }
    })
    .catch((err) => {
      console.log(err);
      if (err.message == 'UNAUTHENTICATED') {
        mainApi.refreshToken(num)
        .then((res) => {
          mainApi.getInfo(num)
          .then((res) => {
            return res.json();
          })
          .then((res) => {
            if (findRes(res) !== undefined) {
              if (findRes(res).length > 0) {
                bot.sendMessage(chatId, `Сейчас в смене ${findRes(res).join(', ')}`)
              }
            }
          })
          .catch((err) => {
            console.log(err);
          })
        })
        .catch((err) => {
          console.log(err);
        })
      }
    })
  }

  if (text == '/help') {
    bot.sendMessage(chatId, '/cs - текущий дежурный первой линии \n/cs2 - текущий дежурный второй линии \n/lin - текущий дежурный инженер Linux \n/win - текущий дежурный инженер Windows');
  }

  if (text == '/gettoken') {
    mainApi.getToken();
  }
});
