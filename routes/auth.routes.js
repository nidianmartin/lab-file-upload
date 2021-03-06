// routes/auth.routes.js

const { Router } = require('express');
const router = new Router();
const bcryptjs = require('bcryptjs');
const saltRounds = 10;
const User = require('../models/User.model');
const Post = require('../models/Post.model');
const Comment = require('../models/comment.model');
const mongoose = require('mongoose');

const routeGuard = require('../configs/route-guard.config');

const multer = require('multer');
const { clearConfigCache } = require('prettier');
const onload = multer({ dest: './public/avatar' });

////////////////////////////////////////////////////////////////////////
///////////////////////////// SIGNUP //////////////////////////////////
////////////////////////////////////////////////////////////////////////

// .get() route ==> to display the signup form to users
router.get('/signup', (req, res) => res.render('auth/signup'));

// .post() route ==> to process form data
router.post('/signup', onload.single('avatar'), (req, res, next) => {
  const { username, email, password } = req.body;

  // const avatar = req.body.avatar = req.file ? `/avatar/${req.file.fileName}` : undefined;

  if (!username || !email || !password) {
    res.render('auth/signup', { errorMessage: 'All fields are mandatory. Please provide your username, email, avatar and password.' });
    return;
  }

  // make sure passwords are strong:
  const regex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/;
  if (!regex.test(password)) {
    res
      .status(500)
      .render('auth/signup', { errorMessage: 'Password needs to have at least 6 chars and must contain at least one number, one lowercase and one uppercase letter.' });
    return;
  }

  bcryptjs
    .genSalt(saltRounds)
    .then(salt => bcryptjs.hash(password, salt))
    .then(hashedPassword => {
      const userParam = req.body;
      userParam.avatar = req.file ? `/avatar/${req.file.filename}` : undefined;
      return User.create({
        // username: username
        username,
        email,
        // passwordHash => this is the key from the User model
        //     ^
        //     |            |--> this is placeholder (how we named returning value from the previous method (.hash()))
        passwordHash: hashedPassword,
        avatar: userParam.avatar
      });
    })
    .then(userFromDB => {
      console.log('Newly created user is: ', userFromDB);
      res.redirect('/userProfile');
    })
    .catch(error => {
      if (error instanceof mongoose.Error.ValidationError) {
        res.status(500).render('auth/signup', { errorMessage: error.message });
      } else if (error.code === 11000) {
        res.status(500).render('auth/signup', {
          errorMessage: 'Username and email need to be unique. Either username or email is already used.'
        });
      } else {
        next(error);
      }
    }); // close .catch()
});

////////////////////////////////////////////////////////////////////////
///////////////////////////// LOGIN ////////////////////////////////////
////////////////////////////////////////////////////////////////////////

// .get() route ==> to display the login form to users
router.get('/login', (req, res) => res.render('auth/login'));

// .post() login route ==> to process form data
router.post('/login', (req, res, next) => {
  const { email, password } = req.body;

  if (email === '' || password === '') {
    res.render('auth/login', {
      errorMessage: 'Please enter both, email and password to login.'
    });
    return;
  }

  User.findOne({ email })
    .then(user => {
      if (!user) {
        res.render('auth/login', { errorMessage: 'Email is not registered. Try with other email.' });
        return;
      } else if (bcryptjs.compareSync(password, user.passwordHash)) {
        req.session.currentUser = user;
        res.redirect('/userProfile');
      } else {
        res.render('auth/login', { errorMessage: 'Incorrect password.' });
      }
    })
    .catch(error => next(error));
});

//Rutas de Post
router.get('/post-form', routeGuard, (req, res, next) => {
  res.render('post/post-form');
});

router.post('/post-form', routeGuard, onload.single('picPath'), (req, res, next) => {
  const { content, picName } = req.body;
  const postParam = req.body;
  postParam.picPath = req.file ? `/avatar/${req.file.filename}` : undefined;
  const id = req.session.currentUser._id;
  Post.create({
    content,
    picName,
    picPath: postParam.picPath,
    creatorId: id
  })
    .then(postFromDB => {
      console.log('Newly created post is: ', postFromDB);
      res.redirect('/');
    })
    .catch(error => {
      console.error(error);
    });
});

//Detalles del Post
router.get('/post/:id', routeGuard, (req, res, next) => {
  const id = req.params.id;
  Post.findById(id)
    .populate('creatorId')
    .populate('comments')
    .populate({
      path: 'comments',
      populate: {
        path: 'authorId',
        model: 'User'
      }
    })
  .then(postDetail => {
    res.render('post/post', { postDetail });
  })
  .catch(error => console.error(error));
});

router.post('/post/:id', routeGuard, onload.single('imagePath'), (req, res, next) => {
  const {content, imageName} = req.body;
  const postParam = req.body;
  postParam.imagePath = req.file ? `/avatar/${req.file.filename}` : undefined;
  const idAuthor = req.session.currentUser._id;
  const idPost = req.params.id;
  Comment.create({
    content,
    imageName,
    postId: idPost,
    imagePath: postParam.imagePath,
    authorId: idAuthor
  })
  .then(comment => {
    console.log(JSON.stringify(comment))
    Post.findByIdAndUpdate(idPost, { $push: { "comment" : comment } }, {new: true})
    .then((post) => {
      res.redirect(`/post/${idPost}`);
    })
    .catch(error => console.error(error));
    
  })
  .catch(error => {
    console.error(error);
  });
});

////////////////////////////////////////////////////////////////////////
///////////////////////////// LOGOUT ////////////////////////////////////
////////////////////////////////////////////////////////////////////////

router.post('/logout', routeGuard, (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

router.get('/userProfile', routeGuard, (req, res) => {
  res.render('users/user-profile');
});

module.exports = router;
