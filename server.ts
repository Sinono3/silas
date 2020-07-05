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
function construct_date(year: string, month: string, date: string) {
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
async function add_entry(db: Database, user: number, date: Date) {
    console.log("Added entry by user" + user + ".");
    db.run('INSERT INTO feedings (who, time) VALUES (?, ?)', user, date.getTime())
}
async function add_entry_now(db: Database, user: number) {
    add_entry(db, user, new Date(Date.now()));
}
async function remove_entry(db: Database, id: number) {
    console.log("Deleted entry", id);
    await db.run("DELETE FROM feedings WHERE feed_id = ?", id);
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
    const date = construct_date(req.params.year, req.params.month, req.params.date);

    if (get_date_string(date) == get_date_string(new Date(Date.now()))) {
        res.redirect("/");
        return;
    }

    res.render('main', await get_ctx_from_date(date));
});
app.get('/', async function (req, res) {
    res.render('main', await get_ctx_from_date(new Date(Date.now())));
});

app.get('/delete/:id', async function (req, res) {
    remove_entry(await open_db(), parseInt(req.params.id));

    res.redirect('back');
});
app.post('/add/:year/:month/:date', async function (req, res) {
    const date = construct_date(req.params.year, req.params.month, req.params.date);
    const times = req.body.time.split(":").map((x: string) => parseInt(x));

    date.setHours(times[0]);
    date.setMinutes(times[1]);

    if (!isNaN(date.getTime()))
        await add_entry(await open_db(), parseInt(req.body.user), date);
    else
        console.warn("Invalid time");

    res.redirect('back');
});

app.post('/feed', async function (req, res) {
    await add_entry_now(await open_db(), parseInt(req.body.user));

    res.redirect('/');
});

app.listen(3000, function () {
    console.log('App is listening on port 3000!');  
});