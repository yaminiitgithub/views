const path = require('path');
require('dotenv').config();
const express = require('express');
const ejs=require('ejs');
const bodyParser=require('body-parser');
const session = require('express-session');
const passport = require('passport');
const mongoose = require('mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;



mongoose.set('debug',true)
const app = express();
app.use(express.static(path.join(__dirname, "views")));
app.set('view engine','ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

mongoose.connect(process.env.DBHOST);


const UserSchema = new mongoose.Schema({
    googleId: String,
    
   secretArray:{type:Array,default:[]}
    
});

UserSchema.plugin(findOrCreate);
const User = mongoose.model('User', UserSchema);
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, {
      id: user.id,
     
    });
  });
});

passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});



passport.use(new GoogleStrategy({
    clientID:process.env.CLIENT_ID,
    clientSecret:process.env.CLIENT_SECRET,
    callbackURL: "https://liberty-nine.vercel.app/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, done) {
    
    
    
    User.findOrCreate({ googleId: profile.id}, function (err, user) {
      
 
      return done(err,user);
      
    });
  }
));
app.get("/",async(req,res)=>{
   try{
    res.render("home")
  }catch(err){
    console.log(err,"not working")
  }
})

app.get('/dashboard', async (req, res) => {
  try {
    const users = await User.find({});
    
    
    let allSecrets = [];

    
    for (const user of users) {
      
      const sortedSecrets = user.secretArray.sort((a, b) => b.time - a.time);
      
  
      allSecrets = allSecrets.concat(sortedSecrets);
    }

    allSecrets.sort((a, b) => b.time - a.time);
    console.log("home")
  
      res.render('dashboard', { secrets: allSecrets,googleId:req.session.googleId });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile','email'] }))
  

  app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/' }),(req,res)=>{
    req.session.googleId=req.user.googleId;
    
    res.redirect('/my_profile')
  });



app.post("/submit",async(req,res)=>{
  
  const input=req.body.secrets;
  const secretObject={text:input,time:new Date(),index:Math.floor(Math.random()*10000),likes:0,ids:[]}
  const googleId =req.session.googleId;

  User.findOne({googleId:googleId})
    .then((found)=>{
      
      found.secretArray.push(secretObject)
      found.save()
        .then((err)=>{
            console.log(err)
        })
      
      res.redirect("/my_profile")
    })
  })
 
app.get('/delete/:index',  async(req, res) => {
 const index=req.params.index;

  const googleId = req.session.googleId;
  try{
    const user = await User.findOne({ googleId: googleId })
    user.secretArray.splice(index,1)
    await user.save();
    console.log("deleted")
      res.redirect("/my_profile");
  }catch(err){
    console.log(err)
  }
          
});




  
  
  app.get('/my_posts',async(req,res)=>{
    const googleId=req.session.googleId;
  
    try {
      const entries = await User.findOne({ googleId: googleId });
      res.render('my_posts', { entries: entries.secretArray });
    } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
    }
  })

  app.post('/like/:index', async (req, res) => {
    const googleId = req.session.googleId;
    const index = parseInt(req.params.index);
    
    try {
        const user = await User.findOne({ 'secretArray.index': index });

        if (user) {
            const arrayIndex = user.secretArray.findIndex(obj => obj.index === index);
            const currentLikes = user.secretArray[arrayIndex].likes;
            var likedByUser = user.secretArray[arrayIndex].ids.includes(googleId);
            let updatedLikes;
            let updateQuery = {};
          function liked(likedByUser){
            if (!likedByUser) {
              
              updatedLikes = currentLikes + 1;
              updateQuery = { $addToSet: { 'secretArray.$.ids': googleId }, $set: { 'secretArray.$.likes': updatedLikes } };
              return updateQuery;

          }
            
            
              
              updatedLikes = currentLikes - 1;
              updateQuery = { $pull: { 'secretArray.$.ids': googleId }, $set: { 'secretArray.$.likes': updatedLikes } };
              return updateQuery;
          }
            var updatedId = liked(likedByUser)
            console.log(updatedId)
            
            await User.findOneAndUpdate(
                { 'secretArray.index': index },
                updatedId,{new:true}
                
            );
            

            
            res.json({ success: true, likes: updatedLikes });
        } else {
            res.status(404).json({ success: false, message: 'Secret not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "FUCK ME " });
    }
});



  
app.get('/my_profile',ensureLoggedIn('/auth/google'),async(req,res)=>{
  res.render("my_profile")
});




    
  app.get('/submit',ensureLoggedIn('/auth/google'), async(req, res)=> {
  
    res.render("submit");
  });   
    
 app.get("/home",(req,res)=>{
  res.redirect("/")
 })   
    
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.sendStatus(500);
    }
    res.redirect('/'); 
  });
});



let PORT=process.env.PORT
app.listen(PORT, function() {
    console.log('Server started on port 3000');
});
