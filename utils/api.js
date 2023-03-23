import dotenv from 'dotenv'
import fetch from "node-fetch";
import querystring from 'querystring';
import {editEnvFile} from './utils.js';
import dayjs from 'dayjs';
import {getToken} from './utils.js';

dotenv.config()

class MainApi {
  _getRequestResult(res) {
    if (res.ok) {
      return res.json();
    } else {
      return Promise.reject(`Ошибка: ${res.status}`);
    }
  }

  refreshToken() {
    return fetch(`https://oauth2.googleapis.com/token`, {
      method: 'POST',
      headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: querystring.stringify({
        client_id:`${process.env.CLIENT_ID}`,
        client_secret:`${process.env.CLIENT_SECRET}`,
        refresh_token:`${process.env.REFRESH_TOKEN}`,
        grant_type:"refresh_token"
      })
    })
    .then((res) => {
      return res.json();
    })
    .then((res) => {
      console.log(res);
      editEnvFile(res.access_token);
    })
  }

  checkToken() {
    return fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${getToken().replace(/\r?\n|\r/g, '')}`, {
      method: 'GET',
    })
    .then(this._getRequestResult)
  }

  getInfo(num, date, endDate) {
    console.log("enddate", endDate);
    let calendarId;

    switch (num) {
      case 1:
        calendarId = process.env.GOOGLE_CALENDAR_ID1;
        break;
      case 2:
        calendarId = process.env.GOOGLE_CALENDAR_ID2;
        break;
      case 3:
        calendarId = process.env.GOOGLE_CALENDAR_LIN;
        break;
      case 4:
        calendarId = process.env.GOOGLE_CALENDAR_WIN;
        break;
    }

    let day;
    let endDay;

    if (!date) {
      day = dayjs();
    } else {
      day = date;
    }

    if (!endDate) {
      endDay = day.add(2, "day");
    } else {
      endDay = endDate;
    }
    // добавление query к url
    const data = {
      timeMin: day.toISOString(),
      timeMax: endDay.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    };

    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
    for (let k in data) {
      url.searchParams.append(k, data[k]);
    }

    return fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${getToken().replace(/\r?\n|\r/g, '')}`,
      },
    })
  }

  getToken() {
    return fetch(`https://oauth2.googleapis.com/token`, {
      method: 'POST',
      headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: querystring.stringify({
        code:`${process.env.CODE}`,
        client_id:`${process.env.CLIENT_ID}`,
        client_secret:`${process.env.CLIENT_SECRET}`,
        redirect_uri:`${process.env.TG_LINK}`,
        grant_type:"authorization_code"
      })
      })
      .then((res) => {
        return res.json();
      })
      .then((res) => {
        console.log(res);
        editEnvFile(res.access_token);
      })
      .catch((err) => {
        console.log(err);
      })
    }
  }

  // Создание экземпляра класса Api
  const mainApi = new MainApi();

  export default mainApi;