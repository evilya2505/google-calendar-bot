import dotenv from 'dotenv'
import fetch from "node-fetch";
import TelegramApi from 'node-telegram-bot-api';
import mainApi from './utils/api.js';
import {returnRes, readWorkersFromJson, readUsersQueueFromJson, addUser, deleteUser, returnWorkersFromDate, returnWorkersInSelectedDate} from './utils/utils.js';
import fs from 'fs';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(customParseFormat);

dotenv.config();

const sourcePath = '.env'
const token = process.env.TG_TOKEN;
const bot = new TelegramApi(token, {polling: true});
const idsForNotifications = process.env.IDS_FOR_NOTIFICATIONS.split(',');
const options = {
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [{text: 'Текущие дежурные', callback_data: 'current'}],
      [{text: 'Следующие дежурные', callback_data: 'next'}]
    ]
  })
};

async function checkTokenFunc() {
  let isTokenValid = false;

  await mainApi.checkToken()
  .then(res => {isTokenValid = true})
  .catch(err => {isTokenValid = false});

  if (!isTokenValid) {
    await mainApi.refreshToken()
    .catch(err => console.log(err));
  }
}

// === Получение данных о текущих и следующих дежурных ===
async function returnCurrentAndNextWorker(num, date) {
  let receivedWorkersData = {current: [], next: []};

  await checkTokenFunc();
  await mainApi.getInfo(num, date)
  .then((res) => {
    return res.json();
  })
  .then((res) => {
    let workers = returnRes(res);
    if (workers.currentWorkers.length > 0 && workers.currentWorkers !== undefined && workers.nextWorkers.length > 0 && workers.nextWorkers !== undefined) {
      receivedWorkersData.current = workers.currentWorkers;
      receivedWorkersData.next = workers.nextWorkers;
    } else {
      throw new Error('Массив пуст');
    }
  })
  .catch(err => console.log(err));


  return receivedWorkersData;
}

// === Айди текущих дежурных ===
function getCurrentWorkersIds(currentWorkers) {
  let idsOfCurrentWorkers = [];
  const workersData = readWorkersFromJson();

  if (workersData.length > 0) {
    for (let i = 0; i < currentWorkers.current.length; i++) {
      for (let j = 0; j < workersData.length; j++) {
        if (currentWorkers.current[i].includes(workersData[j].fullName)) {
          idsOfCurrentWorkers.push('@' + workersData[j].telegramId);
        }
      }
    }
  }

  return idsOfCurrentWorkers;
}

// === Рассылка ===
function sendNotification() {
  for (let i = 0; i < idsForNotifications.length; i++) {
    returnCurrentAndNextWorker(1)
    .then(receivedWorkers => {
      bot.sendMessage(idsForNotifications[i], `Необходимо актуализировать статусы заявок.\nСогласно регалменту https://blog.croc.ru/pages/viewpage.action?pageId=304994562\n${getCurrentWorkersIds(receivedWorkers).join(', ')}`);
    })
  }
}

function startSendingNotifications() {
  sendNotification();
  // 86400000 миллисекунды = 24 часа
  setInterval(sendNotification, 86400000);
}

function handleNotificationSending() {
  const currentTime = dayjs();
  let elevenAMOfToday = dayjs();

  // если время = 11:00:00, то начать отправку уведомлений
  if (dayjs().hour() == 11 && dayjs().minute() == 0 && dayjs().second() == 0) {
    setTimeout(startSendingNotifications, timeDiff);
  } else {
    // если время больше 11:00:00, то прибавлять день
    if (dayjs().hour() >= 11 && dayjs().minute() > 0 && dayjs().second() > 0) {
      elevenAMOfToday = elevenAMOfToday.set('day', dayjs().day() + 1);
    }

    elevenAMOfToday = elevenAMOfToday.set('hour', 11).set('minute', 0).set('second', 0).set('millisecond', 0);

    // разница между текущим временем и 11 утра в миллисекундах
    const timeDiff = Math.abs(currentTime.diff(elevenAMOfToday));

    setTimeout(startSendingNotifications, timeDiff);
  }
}

handleNotificationSending();

// === ===
function sendMessageWithWorkersList(chatId, messageId, messageText) {
  bot.editMessageText(messageText, {
    chat_id: chatId,
    message_id: messageId,
  })
}

bot.on('message', msg => {
  let text = msg.text;
  const chatId = msg.chat.id;
  //--- Команды поиска ---
  if (text == `/findcs\@${process.env.TG_NAME}`) {
    text = '/findcs';
  }

  if (text == `/findcs2\@${process.env.TG_NAME}` || text === '/finddj' || text === `/finddj\@${process.env.TG_NAME}`) {
    text = '/findcs2';
  }

  if (text == `/findlin` || text == `/findwin` || text == '/findcs' || text == '/findcs2') {
    bot.sendMessage(chatId, `Введите дату (например 01.01.2020).`, { parse_mode: 'HTML'})
    addUser({ chatId: chatId, command: text });
  }

  if (dayjs(text.trim(), "DD.MM.YYYY").isValid()) {
    console.log(dayjs(text.trim(), "DD.MM.YYYY").toString());
    let isCorrect = false;
    const usersQueue = readUsersQueueFromJson();
    let currentUser;

    for (let i = 0; i < usersQueue.length; i++) {
      if (usersQueue[i].chatId == chatId) {
        isCorrect = true;
        currentUser = usersQueue[i];
      }
    }

    if (isCorrect) {
      let num;
      deleteUser(chatId);

      switch (currentUser.command) {
        case '/findcs':
          num = 1;
          break;

        case '/findcs2':
          num = 2;
          break;

        case '/findlin':
          num = 3;
          break;

        case '/findwin':
          num = 4;
          break;
      }

      checkTokenFunc()
      .then(res => {
        mainApi.getInfo(num, dayjs(text.trim(), "DD.MM.YYYY"))
        .then(res => {
          return res.json();
        })
        .then(res => {
          bot.sendMessage(currentUser.chatId, returnWorkersFromDate(dayjs(text.trim(), "DD.MM.YYYY"), res));
        })
        .catch(e => {
          console.log(e);
        })
      });
    }
  }

   // --- Вывод работников в заданный промежуток времени ---
   if (text == `/findcs2table\@${process.env.TG_NAME}` || text == '/findcs2table') {
    text = '/findcs2table';
  }

  if (text == '/findcs2table') {
    bot.sendMessage(chatId, `Введите промежуток в формате дата начала - дата конца (например: 01.01.2020 - 03.04.2020).`, { parse_mode: 'HTML'})
    addUser({ chatId: chatId }, true);
  }

  if (text.split('-').map(item => item.trim()).every(item => dayjs(item, "DD.MM.YYYY").isValid()) && text.split('-').length == 2) {
    let isCorrect = false;
    const usersQueue = readUsersQueueFromJson(true);
    let currentUser;

    console.log(usersQueue);
    for (let i = 0; i < usersQueue.length; i++) {
      if (usersQueue[i].chatId == chatId) {
        isCorrect = true;
        currentUser = usersQueue[i];
      }
    }

    if (isCorrect) {
      const NUM = 2;
      const DATE = text.split('-').map(item => item.trim());
      deleteUser(chatId, true);

      checkTokenFunc()
      .then(res => {
        mainApi.getInfo(NUM, dayjs(DATE[0], "DD.MM.YYYY"), dayjs(DATE[1], "DD.MM.YYYY"))
        .then(res => {
          return res.json();
        })
        .then(res => {
          console.log(DATE);
          let messageArr = returnWorkersInSelectedDate(res);

          for (let i = 0; i < messageArr.length; i++) {
            bot.sendMessage(currentUser.chatId, messageArr[i]);
          }
        })
        .catch(e => {
          console.log(e);
        })
      });
    }
  }

  // --- Current/next workers commands ---

  if (text == `/cs\@${process.env.TG_NAME}`) {
    text = '/cs';
  }

  if (text == `/dj\@${process.env.TG_NAME}`) {
    text = '/dj';
  }

  if (text == `/cs2\@${process.env.TG_NAME}`) {
    text = '/cs2';
  }

  if (text == `/lin\@${process.env.TG_NAME}`) {
    text = '/lin';
  }

  if (text == `/win\@${process.env.TG_NAME}`) {
    text = '/win';
  }


  if (text === '/cs' || text === '/cs2' || text === '/lin' || text === '/win' || text === '/dj') {
    bot.sendMessage(chatId, 'Время дежурств', options);
    fs.writeFileSync('./command.txt', text);
  }

  // --- Other commands ---
  if (text == '/help') {
    bot.sendMessage(chatId, '/cs - текущий/следующий дежурный первой линии \n/cs2 - текущий/следующий дежурный второй линии\n\n/findcs, /findcs2, /findlin, /findwin - поиск по дате');
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

    case '/dj':
      num = 2;
      break;

    case '/lin':
      num = 3;
      break;

    case '/win':
      num = 4;
      break;
  }

  returnCurrentAndNextWorker(num)
  .then(receivedWorkers => {
    if (data == 'current') {
      console.log(currentCommand);
      if (receivedWorkers.current.length > 0 && receivedWorkers.current !== undefined) {
        sendMessageWithWorkersList(chatId, messageId, `${currentCommand == '/dj' ? 'Дежурные инженеры второй линии облака:' : 'Сейчас в смене'} ${receivedWorkers.current.join(', ')} ${currentCommand == '/dj' ? getCurrentWorkersIds(receivedWorkers).join(', ') : ''}`);
      }
    } else if (data == 'next' ) {
      if (receivedWorkers.next.length > 0 && receivedWorkers.next !== undefined) {
        sendMessageWithWorkersList(chatId, messageId, `${currentCommand == '/dj' ? 'Следующие дежурные инженеры второй линии облака:' : 'Следующие дежурные: '} ${receivedWorkers.next.join(', ')}`);
      }
    }
  })
});
