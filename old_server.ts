import express = require('express');
import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
//import { } from "./interfaces"

const app: express.Application = express();
app.set('view engine', 'hbs');
app.engine('hbs', require('express-handlebars')({
    layoutsDir: __dirname + '/views/layouts',
    extname: 'hbs',
    defaultLayout: 'index',
    helpers: require("./helpers.ts").helpers
}));
app.use(express.static('public'))
app.use(express.urlencoded());
app.use(express.json());

async function open_db() {
    return await open({
        filename: 'database.db',
        driver: sqlite3.Database
    });
}

async function get_feedings_for_today(db: Database) {
    //db.exec("DELETE FROM feedings");
  
    //db.exec('CREATE TABLE feedings (feed_id INTEGER PRIMARY KEY, who INTEGER, time INTEGER)')
    //db.run('INSERT INTO feedings (who, time) VALUES (1, ?)', Date.now())
    
    let users = await db.all("SELECT id, name FROM users");
    let feedings = await db.all("SELECT * FROM feedings WHERE date(datetime(time / 1000, 'unixepoch')) = date('now')");

    feedings.push({
        who: null,
        time: Date.now()
    });

    /*console.log("SQLite Local ", await db.all("SELECT datetime('now', 'localtime')"));
    console.log("SQLite Epoch ", await db.all("SELECT datetime('now')"));
    console.log("Node -> SQLite Local ", await db.all("SELECT strftime('%d-%m-%Y %H:%M:%S', " + Math.floor(Date.now()) + ", 'unixepoch')"));
    console.log("Node now ", [new Date(Date.now()).toString() ]);*/

    feedings.sort((a, b) => a.time - b.time);
    feedings.reverse();

    feedings.forEach((f, i, a) => {
        if (f.who !== null) {
            a[i].who = users[f.who-1].name;
        } else {
            a[i].who = "anon";
            a[i].anon = true;
        }
        a[i].time = new Date(f.time).toLocaleTimeString("es-PY", { hour12: false });
    });

    return feedings;
}
async function get_users(db: Database) {
    return await db.all("SELECT id, name FROM users");
}
// user ID as input
async function add_feeding_entry(db: Database, user: number) {
    console.log("Added entry by user " + user + ".");
    db.run('INSERT INTO feedings (who, time) VALUES (?, ?)', user, Date.now())
}
async function clear_todays_entries(db: Database) {
    console.log("Deleted today's entries.");
    await db.run("DELETE FROM feedings WHERE date(datetime(time / 1000, 'unixepoch')) = date('now')");
}

app.get('/', async function (req, res) {
    const db = await open_db();
    let feedings = await get_feedings_for_today(db);
    let users = await get_users(db);
    
    res.render('main', {
        feedings: feedings,
        users: users,
        date: new Date(Date.now()).toLocaleDateString()
    });
});

app.post('/feed', async function (req, res) {
    console.log("Request to add entry received!", req.body);

    await add_feeding_entry(await open_db(), parseInt(req.body.user));

    res.redirect("/");
});


app.get('/clear_day_feedings', async function (req, res) {
    await clear_todays_entries(await open_db());
    res.redirect("/");
});

app.listen(3000, function () {
    console.log('App is listening on port 3000!');  
});