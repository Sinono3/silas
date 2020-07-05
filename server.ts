import express = require('express');
import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import { Feeding, User } from "./interfaces"

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

function get_date_string(date: Date) {
    return `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`
}
function construct_date(year: string, month: string, day: string) {
    return new Date(
        parseInt(year), 
        parseInt(month)-1, 
        parseInt(date)
    );
}

async function open_db() {
    return await open({
        filename: 'database.db',
        driver: sqlite3.Database
    });
}

async function get_feedings_for_date(db: Database, date: Date) {
    let users = await db.all("SELECT id, name FROM users");
    let feedings = await db.all(
        "SELECT * FROM feedings WHERE date(datetime(time / 1000, 'unixepoch', 'localtime')) = date(datetime(? / 1000, 'unixepoch', 'localtime'))",
        date.getTime()
    );

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
async function remove_entry(db: Database, id: number) {
    console.log("Deleted entry ", id);
    await db.run("DELETE FROM feedings WHERE id = ?", id);
}
async function get_ctx_from_date(date: Date) {
    const db = await open_db();
    let feedings = await get_feedings_for_date(db, date);
    let users = await get_users(db);
    
    const date_str = get_date_string(date);
    return {
        feedings: feedings,
        users: users,
        date: date_str,
        today: date_str == get_date_string(new Date(Date.now()))
    };
}
app.get('/:year/:month/:date', async function (req, res) {
    const date = construct_date(req.params.year, req.params.month, req.params.day);

    if (get_date_string(date) == get_date_string(new Date(Date.now()))) {
        res.redirect("/");
        return;
    }

    res.render('main', await get_ctx_from_date(date));
});
app.get('/', async function (req, res) {
    res.render('main', await get_ctx_from_date(new Date(Date.now())));
});

app.post('/feed', async function (req, res) {
    console.log("Request to add entry received!", req.body);

    await add_feeding_entry(await open_db(), parseInt(req.body.user));

    res.redirect("/");
});

app.listen(3000, function () {
    console.log('App is listening on port 3000!');  
});