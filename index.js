import dotenv from 'dotenv'
import fetch from "node-fetch";
import TelegramApi from 'node-telegram-bot-api';
import mainApi from './utils/api.js';
import {returnRes} from './utils/utils.js';
import fs from 'fs';

const sourcePath = '.env'

dotenv.config()

const token = process.env.TG_TOKEN;
const bot = new TelegramApi(token, {polling: true});

const options = {
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [{text: 'Текущие дежурные', callback_data: 'current'}],
      [{text: 'Следующие дежурные', callback_data: 'next'}]
    ]
  })
};

bot.on('message', msg => {
  let text = msg.text;
  const chatId = msg.chat.id;

  // --- Current/next workers commands ---

  if (text == `/cs\@${process.env.TG_NAME}`) {
    text = '/cs';
  }

  if (text == `/cs2\@${process.env.TG_NAME}` || text === '/dj') {
    text = '/cs2';
  }

  if (text == `/lin\@${process.env.TG_NAME}`) {
    text = '/lin';
  }

  if (text == `/win\@${process.env.TG_NAME}`) {
    text = '/win';
  }

  if (text === '/cs' || text === '/cs2' || text === '/lin' || text === '/win') {
    bot.sendMessage(chatId, 'Время дежурств', options);
    fs.writeFileSync('./command.txt', text);
  }

  // --- Other commands ---

  if (text === '/getcat') {
    if (chatId != `${process.env.CHAT_ID}`) {
      bot.sendMessage(chatId, 'Иди в мемесы такие команды юзать');
    } else {
      fetch('https://api.thecatapi.com/v1/images/search', {
        method: 'GET',
      })
        .then((res) => {
          return res.json();
        })
        .then((post) => {
          console.log(post);
          bot.sendPhoto(chatId, post[0].url);
        })
    }
  }

  if (text === '/getgachi') {
    if (chatId != `${process.env.CHAT_ID}`) {
      bot.sendMessage(chatId, 'Иди в мемесы такие команды юзать');
    } else {
      let randomNum = Math.trunc(Math.random() * (4 - 1) + 1);
      bot.sendPhoto(chatId, `images/${randomNum}.jpg`);
      console.log(`images/${randomNum}.jpg`);
    }
  }

  if (text === '/getcatgif') {
    if (chatId != `${process.env.CHAT_ID}`) {
      bot.sendMessage(chatId, 'Иди в мемесы такие команды юзать');
    } else {
      const data = {
        limit:1, size:"full" , mime_types: 'gif'
      };

      const url = new URL(`https://api.thecatapi.com/v1/images/search`);

      for (let k in data) {
        url.searchParams.append(k, data[k]);
      }

      fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': 'b849d60a-fe40-46c2-b51c-0f572f22acfd'
        }
      })
      .then(res => {
        return res.json();
      })
      .then(res => {
        bot.sendAnimation(chatId, res[0].url);
      })
      .catch(err => {
        console.log(err);
      })
    }
  };

  if (text == '/help') {
    bot.sendMessage(chatId, '/cs - текущий/следующий дежурный первой линии \n/cs2 - текущий/следующий дежурный второй линии');
  }
});

// --- Callback query ---

bot.on('callback_query', msg => {
  let messageId = msg.message.message_id;
  let data = msg.data;
  const chatId = msg.message.chat.id;
  const currentCommand = fs.readFileSync('./command.txt', "utf8");
  let num;

  switch (currentCommand) {
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
    return res.json();
  })
  .then((res) => {
    if (res?.error?.code == 401) {
      throw new Error('UNAUTHENTICATED');
    }
    let workers = returnRes(res);
    if (data == 'current' && workers.currentWorkers.length > 0 && workers.currentWorkers !== undefined) {
      bot.editMessageText(`Сейчас в смене ${workers.currentWorkers.join(', ')}`, {
        chat_id: chatId,
        message_id: messageId,
        });
    } else if (data == 'next' && workers.nextWorkers.length > 0 && workers.nextWorkers !== undefined) {
      bot.editMessageText(`Следующие дежурные: ${workers.nextWorkers.join(', ')}`, {
        chat_id: chatId,
        message_id: messageId,
        });
    } else {
      throw new Error('Массив пуст');
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

          let workers = returnRes(res);
          if (data == 'current' && workers.currentWorkers.length > 0 && workers.currentWorkers !== undefined) {
            bot.editMessageText(`Сейчас в смене ${workers.currentWorkers.join(', ')}`, {
              chat_id: chatId,
              message_id: messageId,
              });
          } else if (data == 'next' && workers.nextWorkers.length > 0 && workers.nextWorkers !== undefined) {
            bot.editMessageText(`Следующие дежурные: ${workers.nextWorkers.join(', ')}`, {
              chat_id: chatId,
              message_id: messageId,
              });
          } else {
            throw new Error('Массив пуст');
          }
        })
        .catch((err) => {
          if (err.message == 'Массив пуст') {
            bot.sendMessage(chatId, 'Никого нет в смене.');
          }
        })
      })
      .catch((err) => {
        console.log(err);
      })
    }

    if (err.message == 'Массив пуст') {
      bot.sendMessage(chatId, 'Никого нет в смене.');
    }
  })
});