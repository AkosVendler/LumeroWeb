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
    db = client.db('Lumero');
    accountsCollection = db.collection('Accounts');
    console.log('✅ Sikeres csatlakozás a MongoDB-hez.');
  } catch (err) {
    console.error('❌ MongoDB kapcsolódási hiba:', err);
  }
}
// Hívjuk meg a connectDB függvényt
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

app.get('/api/news', async (req, res) => {;
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
    const latest = await db.collection('News').findOne({ _id: new ObjectId(req.params.id)});
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

    console.log('title:', title);
    console.log('leftText:', leftText);
    console.log('rightText:', rightText);
    console.log('image:', image);

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
  console.log('Kapott login adat:', { email, password: '***' }); // Jelszót ne írd ki, csak jelzésképp
  try {
    const user = await accountsCollection.findOne({
      $or: [{ email }, { fullname: email }]
    });
    if (!user) {
      console.log('Nincs ilyen felhasználó:', email);
      return res.status(401).json({ error: 'Nincs ilyen felhasználó.' });
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.log('Hibás jelszó:', email);
      return res.status(401).json({ error: 'Hibás jelszó.' });
    }
    const responseData = { message: 'Sikeres bejelentkezés', isAdmin: user.isAdmin || false };
    console.log('Válasz küldése:', responseData);
    res
      .cookie('userId', user._id.toString(), {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60, // 1 óra
      })
      .status(200)
      .json(responseData);
    res.redirect('/useraccount');
  } catch (err) {
    console.error('Login hiba:', err);
    res.status(500).json({ error: 'Szerverhiba a bejelentkezés során.' });
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
      return res.status(404).json({ error: 'Nincs értesítés.' });
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
      return res.status(404).json({ error: 'Nincs kedvezmény.' });
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
      { projection: { reservations: 1 } }
    );

    if (!user || !user.reservations || user.reservations.length === 0) {
      return res.status(404).json({ error: 'Nincsenek foglalások.' });
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
      room: roomMap[r.roomId] || 'Ismeretlen terem',
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
        user: 'vendler.akos@gmail.com',
        pass: process.env.GMAIL_PASS
      }
    });

    const mailOptions = {
      from: 'vendler.akos@gmail.com',
      to: email,
      subject: 'Jelszó visszaállítás',
      attachments: [
        {
          filename: 'LUMERO.png',
          path: './public/assets/LUMERO.png',
          cid: 'logo123'
        },
        {
          filename: 'white.png',
          path: './public/assets/white.png',
          cid: 'whitebg'
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
      <a href="http://localhost:3000/reset?token=${resetToken}" 
         style="display:inline-block; background-color:#000000; color:#ffffff; padding:14px 28px; text-decoration:none; font-size:15px; font-weight:500;">
        Jelszó visszaállítása
      </a>

    </div>
  </body>
</html>
`
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Visszaállító e-mail elküldve!' });
    console.log('Visszaállító e-mail elküldve!');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Nem sikerült e-mailt küldeni.' });
  }
});


app.get('/reset', async (req, res) => {
  const token = req.query.token;
  console.log(token);

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

  console.log(oldPassword, newPassword);

  try {
    const user = await db.collection('Accounts').findOne({ _id: new ObjectId(req.userId) });

    if (!user) return res.status(404).json({ error: 'Felhasználó nem található.' });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Hibás régi jelszó.' });

    const hashedNew = await bcrypt.hash(newPassword, 10);
    console.log(user._id);
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

function authMiddleware(req, res, next) {
  const userId = req.cookies.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Nincs jogosultság. Jelentkezz be.' });
  }

  req.userId = userId;
  next();
}



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

app.get('/admin/data', async (req, res) => {
  const { userId } = req.cookies;
  if (!userId) return res.status(401).json({ error: 'Nincs bejelentkezve' });

  const user = await db.collection('Accounts').findOne({ _id: new ObjectId(userId) });
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Nincs jogosultság' });

  const orders = await db.collection('Reservation').countDocuments();
  const users = await db.collection('Accounts').countDocuments();

  const reservations = await db.collection('Reservation').aggregate([
    // 1. alakítsuk ObjectId-dá a userId-t és a roomId-t
    {
      $addFields: {
        userObjectId: {
          $cond: {
            if: { $eq: [{ $type: '$userId' }, 'string'] },
            then: { $toObjectId: '$userId' },
            else: '$userId'
          }
        },
        roomObjectId: {
          $cond: {
            if: { $eq: [{ $type: '$roomId' }, 'string'] },
            then: { $toObjectId: '$roomId' },
            else: '$roomId'
          }
        }
      }
    },
    // 2. kapcsoljuk az Accounts-ot
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
    // 3. kapcsoljuk a Rooms-ot
    {
      $lookup: {
        from: 'Rooms',
        localField: 'roomObjectId',
        foreignField: '_id',
        as: 'roomInfo'
      }
    },
    {
      $unwind: { path: '$roomInfo', preserveNullAndEmptyArrays: true }
    },
    // 4. végső projekció
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
        // vendéginfók fallback-ként
        name: {
          $ifNull: ['$userInfo.fullname', '$guest.name']
        },
        email: {
          $ifNull: ['$userInfo.email', '$guest.email']
        },
        roomName: {
          $ifNull: ['$roomInfo.name', 'ismeretlen']
        }
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


// ❗️Webhook előtt NEM szabad json() middleware-t használni!
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const endpointSecret = 'whsec_...'; // Itt add meg a saját titkos kulcsodat
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook hiba:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const buyerEmail = session.customer_details?.email || 'ismeretlen';

    // ✅ Nodemailer konfigurálása
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'vendler.akos@gmail.com',
        pass: 'oflu sakh ujjc bape' // csak App Password, vagy használd .env fájlban!
      }
    });

    // ✅ Email a vevőnek
    const buyerMailOptions = {
      from: 'vendler.akos@gmail.com',
      to: buyerEmail,
      subject: 'Köszönjük a vásárlást!',
      text: 'Sikeres fizetés! Köszönjük, hogy nálunk vásároltál.'
    };

    // ✅ Email az eladónak
    const companyMailOptions = {
      from: 'vendler.akos@gmail.com',
      to: 'vendler.akos@gmail.com',
      subject: 'Új vásárlás',
      text: `Új rendelés érkezett: ${buyerEmail} fizetett $5.`
    };

    // ✅ Emailek küldése
    transporter.sendMail(buyerMailOptions, (err, info) => {
      if (err) {
        console.error('Vevő email hiba:', err);
      } else {
        console.log('Vevő email elküldve:', info.response);
      }
    });

    transporter.sendMail(companyMailOptions, (err, info) => {
      if (err) {
        console.error('Cég email hiba:', err);
      } else {
        console.log('Cég email elküldve:', info.response);
      }
    });
  }

  res.status(200).end();
});

// ✅ Webhook UTÁN jöhet a JSON parser
app.use(express.json());

// ✅ Stripe checkout session létrehozása
app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Demo termék',
            },
            unit_amount: 500,
          },
          quantity: 1,
        },
      ],
      success_url: 'http://localhost:3000/success.html',
      cancel_url: 'http://localhost:3000/cancel.html',
    });

    res.json({ id: session.id });
  } catch (err) {
    console.error('Hiba a checkout session létrehozásakor:', err);
    res.status(500).json({ error: 'Valami hiba történt a fizetés indításakor.' });
  }
});




app.listen(3000, () => console.log('✅ Szerver fut: http://localhost:3000'));
