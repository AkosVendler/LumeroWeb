const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const app = express();
const stripe = require('stripe')('sk_test_51RNbIjIEf5NoZIKrYFFGEbfVka0Qi8HnLayFwYUasL1Y3B9lClrZ5J2UqlvC1vjvQexBQVVElY1F1bOu7GHXnfiM005nC7pF0g');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { log } = require('console');
const cron = require('node-cron');
const { google } = require('googleapis');


// ✅ CORS & static
app.use(cors());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());
app.use(cookieParser());

const uri = process.env.URI; // vagy amit használsz
const client = new MongoClient(uri);
let db;
let accountsCollection;
async function connectDB() {
  try {
    await client.connect();
    db = client.db("Lumero");
    accountsCollection = db.collection("Accounts");
    console.log("✅ Sikeres csatlakozás a MongoDB-hez.");

    // 🔑 Index létrehozása csak most, amikor már van db
    await db.collection("Reservation").createIndex(
      { roomtype: 1, date: 1, startTime: 1, endTime: 1 },
      { unique: true }
    );
    console.log("✅ Index létrehozva a Reservation kollekcióban.");
  } catch (err) {
    console.error("❌ MongoDB kapcsolódási hiba:", err);
  }
}

// Hívjuk meg a connectDB-t szerver induláskor
connectDB().catch(console.error);

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

async function deleteOldResetTokens() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('Lumero');
    const collection = db.collection('ResetTokens');

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const result = await collection.deleteMany({ createdAt: { $lt: threeDaysAgo } });

    console.log(`[${new Date().toISOString()}] Törölt resetTokensek száma: ${result.deletedCount}`);
  } catch (err) {
    console.error('Hiba történt a resetTokensek törlésekor:', err);
  } finally {
    await client.close();
  }
}

// Cron beállítás: 3 naponta egyszer, éjfélkor (0 0 */3 * *)
cron.schedule('0 0 */3 * *', () => {
  console.log('ResetTokensek törlése cron indul...');
  deleteOldResetTokens();
});

// Route: POST /upload-news
app.post('/upload-news', upload.single('image'), async (req, res) => {
  const { title, leftText, rightText } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : '';

  try {
    const newsItem = {
      title,
      leftText,
      rightText,
      imagePath,
      createdAt: new Date()
    };

    await db.collection("News").insertOne(newsItem);
    res.status(200).json({ success: true, message: 'Hír feltöltve!', newsItem });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Hiba történt.' });
  }
});

app.get('/api/news', async (req, res) => {
  ;
  client.connect();
  try {
    const latest = await db.collection('News').find().toArray();
    res.json(latest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/news/:id', async (req, res) => {
  client.connect();
  try {
    const latest = await db.collection('News').findOne({ _id: new ObjectId(req.params.id) });
    res.json(latest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/news/:id', async (req, res) => {
  await client.connect();
  try {
    const result = await db.collection('News').deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 1) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Delete failed' });
  }
});

app.put('/api/news/:id', upload.single('image'), async (req, res) => {
  try {
    // A form adatai
    const { title, leftText, rightText } = req.body;
    const image = req.file;

    if (!title || !leftText || !rightText) {
      return res.status(400).json({ success: false, message: 'Hiányzó mezők!' });
    }

    const updateData = {
      title,
      leftText,
      rightText,
    };

    if (image) {
      updateData.imagePath = `/uploads/${image.filename}`;
    }

    const result = await db.collection('News').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    if (result.modifiedCount === 1) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: 'Nem található a hír' });
    }
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ success: false, error: 'Szerverhiba frissítés közben' });
  }
});



app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await accountsCollection.findOne({
      $or: [{ email }, { fullname: email }]
    });
    if (!user) {
      return res.status(401).json({ error: 'Nincs ilyen felhasználó.' });
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Hibás jelszó.' });
    }
    const responseData = { message: 'Sikeres bejelentkezés', isAdmin: user.isAdmin || false };
    res
      .cookie('userId', user._id.toString(), {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60,
      })
      .status(200)
      .json(responseData);

  } catch (err) {
    console.error('Login hiba:', err);
    res.status(500).json({ error: 'Szerverhiba a bejelentkezés során.' });
  }
});

app.get('/autologin', authMiddleware, async (req, res) => {
  try {
    const user = await accountsCollection.findOne(
      { _id: new ObjectId(req.userId) },
      { projection: { fullname: 1, email: 1, isAdmin: 1 } }
    );

    if (!user) {
      return res.status(401).json({ error: 'Érvénytelen felhasználó.' });
    }

    res.status(200).json({
      message: 'Automatikus bejelentkezés sikeres',
      fullname: user.fullname,
      email: user.email,
      isAdmin: user.isAdmin || false
    });
  } catch (err) {
    console.error('Auto-login hiba:', err);
    res.status(500).json({ error: 'Szerverhiba' });
  }
});


app.get('/user/notifications', authMiddleware, async (req, res) => {
  try {
    // Lekérjük az összes értesítést, ahol a userId tömb tartalmazza a userObjectId-t
    const notifications = await db.collection('Notifications')
      .find({ userId: req.userId })
      .sort({ createdAt: -1 }) // legújabb elöl
      .toArray();

    if (!notifications || notifications.length === 0) {
      return res.status(200).json([]);
    }

    // Visszaadjuk a legutolsó értesítést (a legfrissebbet)
    const lastNotification = notifications[0];

    res.json(notifications);
  } catch (err) {
    console.error('Értesítések lekérése sikertelen:', err);
    res.status(500).json({ error: 'Szerverhiba' });
  }
});

app.get('/user/discounts', authMiddleware, async (req, res) => {
  try {
    const user = await db.collection('Accounts').findOne(
      { _id: new ObjectId(req.userId) },
      { projection: { discounts: 1 } }
    );

    if (!user || !user.discounts || user.discounts.length === 0) {
      return res.status(200).json([]); // üres tömb
    }


    // Csak az érvényes kedvezményeket adjuk vissza
    const validDiscounts = user.discounts.filter(d => d.isValid !== false);

    if (validDiscounts.length === 0) {
      return res.status(404).json({ error: 'Nincs érvényes kedvezmény.' });
    }

    res.json(validDiscounts);
  } catch (err) {
    console.error('Kedvezmények lekérése sikertelen:', err);
    res.status(500).json({ error: 'Szerverhiba' });
  }
});

app.get('/user/reservations', authMiddleware, async (req, res) => {
  try {
    const user = await db.collection('Accounts').findOne(
      { _id: new ObjectId(req.userId) },
      { projection: { reservations: 1, } }
    );



    if (!user || !user.reservations || user.reservations.length === 0) {
      return res.status(200).json([]);
    }

    const reservationIds = user.reservations.map(id => new ObjectId(id));

    const reservations = await db.collection('Reservation')
      .find({ _id: { $in: reservationIds } })
      .toArray();


    // Szoba ID-k összegyűjtése
    const roomIds = reservations.map(r => new ObjectId(r.roomId));

    const rooms = await db.collection('Rooms')
      .find({ _id: { $in: roomIds } })
      .toArray();

    const roomMap = {};
    rooms.forEach(room => {
      roomMap[room._id.toString()] = room.name;
    });

    const formatted = reservations.map(r => ({
      room: roomMap[r.roomId?.toString()] || r.roomtype || "Ismeretlen szoba",
      date: r.date,
      startTime: r.startTime,
      duration: r.duration,
      people: r.people
    }));

    res.json(formatted);

  } catch (err) {
    console.error('Foglalások lekérése sikertelen:', err);
    res.status(500).json({ error: 'Szerverhiba' });
  }
});

app.post('/api/password-reset', async (req, res) => {
  const { email } = req.body;


  if (!email) {
    return res.status(400).json({ error: 'E-mail kötelező' });
  }

  const db = client.db('Lumero'); // adatbázis
  const usersCollection = db.collection('Accounts');
  const resetTokensCollection = db.collection('ResetTokens');

  try {
    // Felhasználó keresése email alapján
    const user = await usersCollection.findOne({ email: email });
    if (!user) {
      return res.status(404).json({ error: 'Nincs ilyen e-mail címhez tartozó felhasználó.' });
    }

    // Token generálás
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Token és userId mentése
    await resetTokensCollection.insertOne({
      resetToken: resetToken,
      userId: user._id,
      createdAt: new Date()
    });

    // Nodemailer setup
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Jelszó visszaállítás',
      attachments: [
        {
          filename: 'LUMERO.png',
          path: './public/assets/LUMERO.png',
          cid: 'logo123'
        }
      ],
      html: `<!DOCTYPE html>
<html lang="hu">
  <head>
    <meta charset="UTF-8" />
    <title>Jelszó visszaállítása</title>
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
  </head>
  <body style="margin:0; padding:0; background-color:#ffffff; color:#000000; font-family: Arial, sans-serif;">

    <div class="email-container" style="max-width:600px; margin:0 auto; padding:40px; text-align:center; background-color:#ffffff;">

      <!-- Logo fix fehér hátterű kép, NE filterezd -->
      <img src="cid:logo123" alt="Logo" width="200" style="display:block; margin: 0 auto; border:0; filter:none;" class="no-invert" />

      <!-- Cím -->
      <h2 style="font-size:16px; font-weight:500; margin-top:50px; margin-bottom:30px; text-transform:uppercase; color:#000;">
        Jelszó visszaállítása
      </h2>

      <!-- Leírás -->
      <p style="font-size:15px; color:#333; margin-bottom:40px;">
        A jelszavad megváltoztatásához kattints a jelszó visszaállítása gombra. Ha nem te kérted ezt az e-mailt, egyszerűen figyelmen kívül hagyhatod.
      </p>

      <!-- Gomb -->
      <a href="${process.env.DOMAIN}reset?token=${resetToken}" 
         style="display:inline-block; background-color:#000000; color:#ffffff; padding:14px 28px; text-decoration:none; font-size:15px; font-weight:500;">
        Jelszó visszaállítása
      </a>

    </div>
  </body>
</html>
`
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Visszaállító e-mail elküldve!' });;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Nem sikerült e-mailt küldeni.' });
  }
});


app.get('/reset', async (req, res) => {
  const token = req.query.token;

  resetTokensCollection = db.collection('ResetTokens');
  if (!token) {
    return res.status(400).send('Hiányzó token.');
  }

  try {
    const tokenDoc = await resetTokensCollection.findOne({ resetToken: token });

    if (!tokenDoc) {
      return res.status(401).send('Érvénytelen vagy lejárt token.');
    }

    // Token érvényes -> küldjük vissza a passwordreset.html fájlt
    res.sendFile(path.join(__dirname, 'public', 'passwordreset.html'));
  } catch (err) {
    console.error('Hiba a token hitelesítésekor:', err);
    res.status(500).send('Szerverhiba.');
  }
});

app.post('/change-password', authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;


  try {
    const user = await db.collection('Accounts').findOne({ _id: new ObjectId(req.userId) });

    if (!user) return res.status(404).json({ error: 'Felhasználó nem található.' });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Hibás régi jelszó.' });

    const hashedNew = await bcrypt.hash(newPassword, 10);
    await db.collection('Accounts').updateOne(
      { _id: user._id },
      { $set: { password: hashedNew } }
    );

    res.json({ message: 'Sikeres jelszócsere.' });
  } catch (err) {
    console.error('Jelszócsere hiba:', err);
    res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Hiányzó token vagy jelszó.' });
  }

  try {
    const resetTokensCollection = db.collection('ResetTokens');
    const usersCollection = db.collection('Accounts');

    // Ellenőrizzük, hogy létezik-e a token
    const tokenDoc = await resetTokensCollection.findOne({ resetToken: token });

    if (!tokenDoc) {
      return res.status(401).json({ error: 'Érvénytelen vagy lejárt token.' });
    }

    const userId = tokenDoc.userId; // Feltételezzük, hogy userId is van benne

    if (!userId) {
      return res.status(400).json({ error: 'A token nincs összekapcsolva felhasználóval.' });
    }

    // Jelszó hashelése (bcrypt)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Jelszó frissítése a Users kollekcióban
    await usersCollection.updateOne(
      { _id: userId },
      { $set: { password: hashedPassword } }
    );

    // Token törlése (egy alkalommal használatos)
    await resetTokensCollection.deleteOne({ resetToken: token });

    return res.json({ message: 'Jelszó sikeresen frissítve.' });
  } catch (err) {
    console.error('Hiba a jelszóváltoztatáskor:', err);
    res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.post("/api/update-notifications", async (req, res) => {
  const token = req.cookies.userId;
  const { isNotiAllowed } = req.body;

  if (!token) {
    return res.status(401).json({ error: "Nincs bejelentkezve" });
  }

  try {
    const userId = token;

    await accountsCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { isNotiAllowed } }
    );

    res.status(200).json({ message: "Frissítve" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Szerverhiba" });
  }
});



app.post('/register', async (req, res) => {
  const { email, fullname, password, isNotiAllowed, isCookieAllowed } = req.body;

  // Kötelező checkbox ellenőrzés
  if (!isCookieAllowed) {
    return res.status(400).json({ error: 'El kell fogadnod a cookie-kezelést.' });
  }

  try {
    const existingUser = await accountsCollection.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Ez az email már foglalt.' });
    }

    // Hash-elés
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = {
      fullname,
      email,
      password: hashedPassword,
      isAdmin: false, // alapértelmezetten ne legyen admin
      isNotiAllowed: !!isNotiAllowed,     // true vagy false
      isCookieAllowed: !!isCookieAllowed, // kötelező checkbox
    };

    const result = await accountsCollection.insertOne(newUser);

    res.status(201).json({ message: 'Sikeres regisztráció!', userId: result.insertedId });
  } catch (err) {
    console.error('Szerverhiba:', err);
    res.status(500).json({ error: 'Szerverhiba' });
  }
});

function calculateEndTime(startTime, duration) {
  // Ha duration 'egész nap', akkor fixen 09:00-17:00
  if (duration === 'Teljes nap' || duration === '8' || duration === 8) {
    return "17:00";
  }

  // startTime formátuma: "HH:MM"
  const [startHour, startMinute] = startTime.split(':').map(Number);

  // duration órában (szám)
  const endHour = startHour + Number(duration);

  // Vissza formázva "HH:MM"
  // Ha elmegy 24 fölé, akkor egyszerűen nem fog előfordulni ebben az esetben, de ha kell, lehet bővíteni.
  return `${endHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
}



// Unique index létrehozása (szerver induláskor fusson le egyszer)
const CREDENTIALS_PATH = './service-account.json';

app.post('/api/reserv', async (req, res) => {

  const cookies = req.cookies; // ha van cookie-parser
  const userId = cookies?.userId;

  if (!userId && !req.body.force) {
    return res.status(200).json({
      warning: true,
      message: "Nem vagy bejelentkezve. Biztos, hogy így is foglalni szeretnél?",
    });
  }

  let {
    fullname,
    roomtype,
    phone,
    email,
    date,
    startTime,
    duration,
    people,
    message,
    decoration,
    catering,
    organization,
  } = req.body;

  // Kötelező mezők ellenőrzése
  if (!fullname || !roomtype || !phone || !email || !date || !startTime || !duration || !people) {
    return res.status(400).json({ error: 'Minden mezőt ki kell tölteni!' });
  }

  try {
    let actualDuration = duration === 'Teljes nap' ? 8 : parseInt(duration);
    let actualStartTime = startTime;
    let endTime;

    if (duration === 'Teljes nap') {
      actualStartTime = '09:00';
      endTime = '17:00';
    } else {
      endTime = calculateEndTime(startTime, actualDuration);
    }

    const newBooking = {
      fullname,
      userId,
      roomtype,
      phone,
      email,
      date,
      startTime: actualStartTime,
      originalStartTime: duration === 'Teljes nap' ? startTime : null,
      endTime,
      duration: actualDuration,
      people: parseInt(people),
      message,
      extras: {
        decoration: !!decoration,
        catering: !!catering,
        organization: !!organization,
      },
      createdAt: new Date(),
    };

    // 🔑 insertOne + duplikált hibakezelés
    let bookingResult;
    try {
      bookingResult = await db.collection('Reservation').insertOne(newBooking);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({
          error: 'Erre az időpontra már van foglalás!',
        });
      }
      throw err;
    }

    // Szoba frissítése
    const room = await db.collection('Rooms').findOne({ name: roomtype });
    if (!room) {
      return res.status(404).json({ error: 'A kiválasztott szoba nem található.' });
    }

    const updatedDates = room.dates || {};

    if (!updatedDates[date]) {
      await db.collection('Rooms').updateOne(
        { _id: room._id },
        { $set: { [`dates.${date}`]: [] } }
      );
    }

    await db.collection('Rooms').updateOne(
      { _id: room._id },
      { $push: { [`dates.${date}`]: { startTime: actualStartTime, endTime } } }
    );

    if (userId) {
      await db.collection("Accounts").updateOne(
        { _id: new ObjectId(userId) },
        {
          $addToSet: {
            reservations: bookingResult.insertedId.toString()
          }
        },
        { upsert: true }
      );
    }

    // --- EMAIL USERNEK ---
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: newBooking.email,
      subject: 'LUMERO | Sikeres Foglalás🎉',
      attachments: [
        {
          filename: 'LUMERO.png',
          path: './public/assets/LUMERO.png',
          cid: 'logo123'
        }
      ],
      html: `<!DOCTYPE html>
<html lang="hu">
  <head>
    <meta charset="UTF-8" />
    <title>Sikeres Foglalás</title>
  </head>
  <body style="margin:0; padding:0; background-color:#ffffff; color:#000000; font-family: Arial, sans-serif;">
    <div style="max-width:600px; margin:0 auto; padding:40px; text-align:center; background-color:#ffffff;">
      <img src="cid:logo123" alt="Logo" width="200" style="display:block; margin: 0 auto;" />
      <h2 style="font-size:16px; margin-top:50px; margin-bottom:30px;">Sikeres foglalás!</h2>
      <p>Köszönjük foglalásodat, a részleteket bármikor megtudod tekinteni a fiókodban.</p>
      <p>Foglalásod azonosítója:</p>
      <div style="display:inline-block; background-color:#000; color:#fff; padding:14px 28px;">${bookingResult.insertedId}</div>
      <p>Időpont:</p>
      <div style="display:inline-block; background-color:#000; color:#fff; padding:14px 28px;">${newBooking.date + " " + newBooking.startTime + " " + newBooking.endTime}</div>
      <p>A következő emailben csatolt díjbekérő dokumentumban található számlaszámra kell utalni a fizetendő összeget.</p>
    </div>
  </body>
</html>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.error('Hiba az email küldésekor:', error);
      }
      console.log('Email elküldve:', info.response);
    });

    // --- EMAIL ADMINNAK ---
    const transporter2boss = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });

    const mailOptions2boss = {
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: 'LUMERO | Foglalás érkezett🎉',
      attachments: [
        {
          filename: 'LUMERO.png',
          path: './public/assets/LUMERO.png',
          cid: 'logo123'
        }
      ],
      html: `<!DOCTYPE html>
<html lang="hu">
  <head>
    <meta charset="UTF-8" />
    <title>Foglalás érkezett</title>
  </head>
  <body style="margin:0; padding:0; background-color:#ffffff; color:#000000; font-family: Arial, sans-serif;">
    <div style="max-width:600px; margin:0 auto; padding:40px; text-align:center; background-color:#ffffff;">
      <img src="cid:logo123" alt="Logo" width="200" style="display:block; margin: 0 auto;" />
      <h2 style="font-size:16px; margin-top:50px; margin-bottom:30px;">Új Foglalás érkezett!</h2>
      <a href="${process.env.DOMAIN}admin" style="display:inline-block; background-color:#000; color:#fff; padding:14px 28px;">Ide kattintva látod a részleteket</a>
    </div>
  </body>
</html>`
    };

    transporter2boss.sendMail(mailOptions2boss, (error, info) => {
      if (error) {
        return console.error('Hiba az email küldésekor:', error);
      }
      console.log('Email elküldve:', info.response);
    });

    await addBookingToGoogleCalendar(newBooking);

    // --- VÉGÜL ---
    res.status(201).json({ message: 'Sikeres foglalás!', bookingId: bookingResult.insertedId });

  } catch (err) {
    console.error('Szerverhiba:', err);
    res.status(500).json({ error: 'Szerverhiba' });
  }
});


async function addBookingToGoogleCalendar(booking) {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
      summary: `${booking.fullname} - ${booking.roomtype}`,
      description: `
Email: ${booking.email}
Telefon: ${booking.phone}
Szoba: ${booking.roomtype}
Üzenet: ${booking.message || 'nincs'}
Extras: ${booking.extras.decoration ? 'Dekoráció, ' : ''}${booking.extras.catering ? 'Catering, ' : ''}${booking.extras.organization ? 'Szervezés' : ''}
      `,
      start: {
        dateTime: new Date(`${booking.date}T${booking.startTime}:00`).toISOString(),
        timeZone: 'Europe/Budapest',
      },
      end: {
        dateTime: new Date(`${booking.date}T${booking.endTime}:00`).toISOString(),
        timeZone: 'Europe/Budapest',
      },
    };

    const response = await calendar.events.insert({
      calendarId: process.env.CALENDAR_ID,
      requestBody: event,
    });

    console.log('Google Calendar event létrehozva:', response.data.htmlLink);
    return response.data;
  } catch (err) {
    console.error('Hiba a Google Calendar esemény létrehozásakor:', err);
    throw err;
  }
}


function authMiddleware(req, res, next) {
  const userId = req.cookies.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Nincs jogosultság. Jelentkezz be.' });
  }

  req.userId = userId;
  next();
}
app.get('/api/notifications', async (req, res) => {
  try {
    const notifications = await db
      .collection('Notifications')
      .find({})
      .sort({ createdAt: -1 }) // legújabb elöl
      .toArray();

    res.status(200).json(notifications);
  } catch (err) {
    console.error('Hiba a lekérésnél:', err);
    res.status(500).json({ error: 'Szerverhiba' });
  }
});

app.delete('/api/notifications/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const result = await db.collection("Notifications").deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Nem található az értesítés' });
    }
    res.json({ message: 'Értesítés törölve' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Hiba történt a törlés közben' });
  }
});



app.post('/api/notifications', async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'A cím és leírás megadása kötelező.' });
    }

    // 🔍 Az összes user, akinek be van kapcsolva az értesítés
    const activeUsers = await db.collection('Accounts')
      .find({ isNotiAllowed: true })
      .project({ _id: 1 }) // csak az _id-t kérjük
      .toArray();

    const userIds = activeUsers.map(user => user._id.toString()); // ha stringként tárolod

    const notification = {
      title,
      description,
      userId: userIds, // több userId
      createdAt: new Date(),
    };

    const result = await db.collection('Notifications').insertOne(notification);

    res.status(201).json({
      message: 'Értesítés létrehozva',
      id: result.insertedId,
      affectedUsers: userIds.length
    });
  } catch (err) {
    console.error('Hiba:', err);
    res.status(500).json({ error: 'Szerverhiba' });
  }
});


app.get('/user', authMiddleware, async (req, res) => {
  try {
    const user = await accountsCollection.findOne({ _id: new ObjectId(req.userId) });

    if (!user) {
      return res.status(404).json({ error: 'Felhasználó nem található.' });
    }

    res.json({
      fullname: user.fullname,
      email: user.email,
      isAdmin: user.isAdmin,
      isNotiAllowed: user.isNotiAllowed,
      isCookieAllowed: user.isCookieAllowed,
    });
  } catch (err) {
    console.error('Hiba:', err);
    res.status(500).json({ error: 'Szerverhiba' });
  }
});

// Admin oldal kiszolgálása
app.get('/admin', (req, res) => {
  // Itt ellenőrizhetsz session-t vagy cookie-t, hogy be van-e jelentkezve admin
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Felhasználói fiók oldal
app.get('/useraccount', (req, res) => {
  // Itt ellenőrizhetsz, hogy be van-e jelentkezve a user
  res.sendFile(path.join(__dirname, 'public', 'useraccount.html'));
});

app.get('/api/bookings', (req, res) => {
  const room = req.query.room;

  db.collection('Rooms').findOne({ name: room }).then(doc => {
    if (!doc) return res.status(404).json({ error: "Szoba nem található" });
    res.json({ dates: doc.dates }); // <-- fontos: ne csak a `dates`-et küldd, hanem egy objektumban
  });
});


async function getFreeTimes(dateStr) {
  const allSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  try {
    await client.connect();
    const db = client.db(dbName);
    const bookings = await db.collection('Rooms').find({ date: dateStr }).toArray();

    let bookedSlots = new Set();

    bookings.forEach(b => {
      const startIdx = allSlots.indexOf(b.startTime);
      const endIdx = allSlots.indexOf(b.endTime);

      if (startIdx === -1 || endIdx === -1) return;

      for (let i = startIdx; i < endIdx; i++) {
        bookedSlots.add(allSlots[i]);
      }
    });

    const freeSlots = allSlots.filter(t => !bookedSlots.has(t));

    return freeSlots;
  } finally {
    await client.close();
  }
}

app.get('/api/free-times/:date', async (req, res) => {
  const dateStr = req.params.date;

  try {
    const freeSlots = await getFreeTimes(dateStr);
    res.json({ freeSlots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/admin/data', async (req, res) => {
  const { userId } = req.cookies;
  if (!userId) return res.status(401).json({ error: 'Nincs bejelentkezve' });

  const user = await db.collection('Accounts').findOne({ _id: new ObjectId(userId) });
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Nincs jogosultság' });

  const orders = await db.collection('Reservation').countDocuments();
  const users = await db.collection('Accounts').countDocuments();

  const reservations = await db.collection('Reservation').aggregate([
    {
      $addFields: {
        userObjectId: {
          $cond: {
            if: { $eq: [{ $type: '$userId' }, 'string'] },
            then: { $toObjectId: '$userId' },
            else: '$userId'
          }
        }
      }
    },
    {
      $lookup: {
        from: 'Accounts',
        localField: 'userObjectId',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    {
      $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true }
    },
    {
      $project: {
        date: 1,
        startTime: 1,
        duration: 1,
        people: 1,
        message: 1,
        extras: 1,
        createdAt: 1,
        phone: 1,
        name: {
          $ifNull: [
            '$userInfo.fullname',
            '$fullname',      // itt a root mezőből
            '$guest.name'    // ha van guest mező, lehet még használni
          ]
        },
        email: {
          $ifNull: [
            '$userInfo.email',
            '$email',        // itt a root mezőből
            '$guest.email'   // ha van guest mező
          ]
        },
        roomName: '$roomtype'
      }
    }
  ]).toArray();


  res.json({ orders, users, adminName: user.fullname, reservations });
});



app.get('/logout', (req, res) => {
  res.clearCookie('userId');
  res.redirect('/'); // vagy '/' ha a főoldalra akarod
});

app.delete('/admin/deleteOrder/:id', async (req, res) => {
  const orderId = req.params.id;
  try {
    // Feltételezve, hogy egy adatbázisban tárolod, pl. MongoDB
    await db.collection('Reservation').deleteOne({ _id: new ObjectId(orderId) });
    res.status(200).send({ message: 'Törlés sikeres' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Törlés sikertelen' });
  }
});








app.listen(3000, () => console.log('✅ Szerver fut: http://localhost:3000'));
