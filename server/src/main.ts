import express from 'express';
import cors from 'cors';
import database, { Connect } from './database';

import fs from 'fs';
import https from 'https';
import path from 'path';
import session from 'express-session';
import passport from 'passport';
import DiscordStrategy from 'passport-discord';
import { FRONTEND_URL, API_URL } from '../settings.json';
// import './get/commands';


 const privateKey = fs.readFileSync(path.join(__dirname, 'key.pem'), 'utf8');
 const certificate = fs.readFileSync(path.join(__dirname, 'cert.pem'), 'utf8');
 const credentials = { key: privateKey, cert: certificate };

 const CLIENT_ID = '937011056260313099';
 const CLIENT_SECRET = '30qbfLoDNQIXYXC52PIu2SlkeJyTyyuG';
 const CALLBACK_URL = `${API_URL}/auth/discord/callback`;

export const app = express();

// Middleware to parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Configure CORS
app.use(cors({
    origin: FRONTEND_URL, // Replace with your React app URL
    credentials: true
}));

passport.use(new DiscordStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    scope: ['identify', 'email']
},  (accessToken, refreshToken, profile, done) => {
    // Here you can save the profile information into the database
    return done(null, profile);
  }));

passport.serializeUser((user, done) => {
    done(null, user);
});
passport.deserializeUser((obj, done) => {
    done(null, obj);
});

// Session middleware
app.use(session({
    secret: 'asdLKAA@JIOdaji',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true, // Schimbă la true dacă folosești HTTPS
        httpOnly: false,
        sameSite: 'none' // 'none' este necesar pentru a permite trimiterea cookie-urilor între domenii diferite
    }
  }));

app.use(passport.initialize());
app.use(passport.session());

Connect();

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback', passport.authenticate('discord', {
    failureRedirect: '/'
}), (req, res) => {
    res.redirect(`${FRONTEND_URL}/dashboard`);
})

app.get('/api/user', (req, res) => {
  if(req.isAuthenticated())
    res.json(req.user);
    
  else {
      res.redirect('/auth/discord');    
    // res.status(401).json({ message: 'Not authenticated'});
}    
});

app.get('/profile', (req, res) => {
    if(req.isAuthenticated()) {
        res.json(req.user);
    } else {
        res.redirect('/auth/discord');
    }
})

app.get('/guilds/:owner_id', (req, result) => {
    database.query('select * from guilds where ownerId=?', [req.params.owner_id], (err, res) => {
        if(err)
        {
            console.error(err);
            return;
        }

        result.json(res);
    });
});



app.get('/logout', (req, result, next) => {
    req.logout((err) => {
        if(err)
            return next(err);

        result.redirect(`${FRONTEND_URL}`);
    });
});

app.get('/users/:guild_id', (req, result) => {
    database.query('select * from users where guildId=?', [req.params['guild_id']], (err, res) => {
        if(err)
        {
            console.error(err);
            return;
        }
        
        result.json(res);
    }); 
});


app.get('/guilds/:guild_id/user/:user_id', (req, result) => {
    database.query('select * from users where guildId=? and discordId=?', [req.params['guild_id'], req.params['user_id']], (err, res) => {
        if(err)
        {
            console.error(err);
            return;
        }

        result.json(res[0]);
    }); 
});

app.get('/guilds/:guild_id/top', (req, result) => {
    database.query('select * from users where guildId=? and coins > 0 order by coins DESC', [req.params['guild_id']], (err, res) =>{
        if(err)
        {
            console.error(err);
            return;
        }
        result.json(res);
    });
});

app.get('/logs/:guild_id', (req, result) => {
    database.query('select * from logs where guildId=?', [req.params['guild_id']], (err, res) => {
        if(err)
        {
            console.error(err);
            return;
        }

        result.json(res);
    });
});

app.put('/user/:user_id', (req, res) => {
    if(!req.isAuthenticated())
    {
        console.log(req.isAuthenticated());
        res.send(req.authInfo);
        console.log('You are not logged.');
    }
    else {
        var body = {...req.body};
        delete body.id;

        database.query('update users set ? where discordId=?', [body, req.params['user_id']], (err, res) => {
            if(err)
            {
                console.error(err);
                return;
            }
        })
        console.log(req.body);
    }


}); 
app.get('/commands', (request, result) => {
    database.query('select * from commands', (err, res) => {
        if(err)
        {
            console.error(err);
            result.sendStatus(404);
            return;
        }
        
        result.json(res);
    })
});
app.get('/:guild_id/charts', (request, result) => {
    if(request.isAuthenticated())
    {
        database.query('select * from user_charts where guildId=?', [request.params['guild_id']], (err, res) => {
            if(err)
            {
                console.error(err);
                result.sendStatus(404);
                return;
            }
            
            result.json(res);
        })
    }
    else result.sendStatus(404);
});
// Create an HTTPS server
const httpsServer = https.createServer(credentials, app);

httpsServer.listen(4000, () => {
  console.log(`HTTPS Server running on ${API_URL}`);
});