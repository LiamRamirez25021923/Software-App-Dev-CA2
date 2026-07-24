require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');

const pool = require('./config/db');
const newsHub = require('./src/services/newshub.service');

const app = express();
const PORT = Number(process.env.PORT) || 3001;


app.set('view engine','ejs');
app.set('views',path.join(__dirname,'views'));
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));
app.use(session({secret:process.env.SESSION_SECRET||'development-only-change-me',resave:false,saveUninitialized:false,cookie:{httpOnly:true,secure:false,sameSite:'lax',maxAge:86400000}}));
app.use((req,res,next)=>{res.locals.currentUser=req.session.user||null;res.locals.isAdmin=req.session.user?.role==='admin';res.locals.currentPath=req.path;next();});
function requireLogin(req,res,next){if(!req.session.user)return res.redirect('/login');next();}
function requireAdmin(req,res,next){if(!req.session.user)return res.redirect('/login');if(req.session.user.role!=='admin')return res.status(403).render('error',{title:'Access denied',message:'This page is available only to SavePoint administrators.'});next();}
async function seedAccount({username,password,email,role}){const [rows]=await pool.execute('SELECT id FROM users WHERE username=? LIMIT 1',[username]);if(rows.length)return;const hash=await bcrypt.hash(password,12);await pool.execute('INSERT INTO users (username,email,password,role) VALUES (?,?,?,?)',[username,email||`${username}@savepoint.local`,hash,role]);}
async function ensureUsersTableSchema(){
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY,username VARCHAR(50) NOT NULL UNIQUE,email VARCHAR(150) NOT NULL UNIQUE,password VARCHAR(255) NOT NULL,profile_image TEXT DEFAULT 'default_profile.png',banner_image TEXT DEFAULT 'default_banner.png',role ENUM('admin','user') NOT NULL DEFAULT 'user',bio TEXT,favourite_console VARCHAR(100),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  const [columns]=await pool.query('SHOW COLUMNS FROM users');
  const existing=new Set(columns.map(column=>column.Field));
  const migrations=[];
  if(!existing.has('email')) migrations.push("ALTER TABLE users ADD COLUMN email VARCHAR(150) NOT NULL UNIQUE");
  if(!existing.has('password')) migrations.push("ALTER TABLE users ADD COLUMN password VARCHAR(255) NOT NULL");
  if(!existing.has('profile_image')) migrations.push("ALTER TABLE users ADD COLUMN profile_image TEXT DEFAULT 'default_profile.png'");
  if(!existing.has('banner_image')) migrations.push("ALTER TABLE users ADD COLUMN banner_image TEXT DEFAULT 'default_banner.png'");
  if(!existing.has('bio')) migrations.push('ALTER TABLE users ADD COLUMN bio TEXT');
  if(!existing.has('favourite_console')) migrations.push("ALTER TABLE users ADD COLUMN favourite_console VARCHAR(100)");
  if(!existing.has('created_at')) migrations.push("ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  for(const statement of migrations){await pool.query(statement);} 
}
async function initialiseDatabase(){
 await ensureUsersTableSchema();
 await pool.query(`CREATE TABLE IF NOT EXISTS products (id INT AUTO_INCREMENT PRIMARY KEY,seller_user_id INT NULL,title VARCHAR(150) NOT NULL,description TEXT,category VARCHAR(80) NOT NULL,platform VARCHAR(80),price DECIMAL(10,2) NOT NULL DEFAULT 0,quantity INT NOT NULL DEFAULT 1,image_url VARCHAR(255),status ENUM('active','sold','removed') NOT NULL DEFAULT 'active',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,CONSTRAINT fk_products_seller FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE SET NULL)`);
 await pool.query(`CREATE TABLE IF NOT EXISTS forum_posts (id INT AUTO_INCREMENT PRIMARY KEY,author_user_id INT NULL,title VARCHAR(180) NOT NULL,body TEXT NOT NULL,status ENUM('visible','removed') NOT NULL DEFAULT 'visible',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,CONSTRAINT fk_forum_author FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL)`);
 await pool.query(`CREATE TABLE IF NOT EXISTS news_items (id INT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(200) NOT NULL,summary TEXT,source_name VARCHAR(120),source_url VARCHAR(500),published_at DATETIME,status ENUM('visible','hidden') NOT NULL DEFAULT 'visible',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
 await seedAccount({username:'SavePoint',password:'NintendoGamesTheyreSoFunToPlay',email:'admin@savepoint.local',role:'admin'});
 await seedAccount({username:'Dingleton',password:'123',email:'dingleton@savepoint.local',role:'user'});
 const [[pc]]=await pool.query('SELECT COUNT(*) total FROM products');if(!Number(pc.total)){const [[u]]=await pool.execute('SELECT id FROM users WHERE username=?',['SavePoint']);await pool.execute('INSERT INTO products (seller_user_id,title,description,category,platform,price,quantity) VALUES (?,?,?,?,?,?,?)',[u.id,'Nintendo Game Boy Color','Starter marketplace listing.','Hardware','Game Boy',129.90,1]);}
 const [[fc]]=await pool.query('SELECT COUNT(*) total FROM forum_posts');if(!Number(fc.total)){const [[u]]=await pool.execute('SELECT id FROM users WHERE username=?',['Dingleton']);await pool.execute('INSERT INTO forum_posts (author_user_id,title,body) VALUES (?,?,?)',[u.id,'What retro game are you playing right now?','Starter discussion post.']);}
 const [[nc]]=await pool.query('SELECT COUNT(*) total FROM news_items');if(!Number(nc.total))await pool.execute('INSERT INTO news_items (title,summary,source_name,published_at) VALUES (?,?,?,NOW())',['SavePoint News Hub is ready','This confirms that retro gaming news can be stored in MySQL.','SavePoint']);
}
const sessionUser=u=>({id:u.id,username:u.username,displayName:u.username,email:u.email,role:u.role});
function parseSelectedNewsSources(value) {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) return value;
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

app.get('/',(req,res)=>res.redirect(req.session.user?'/dashboard':'/login'));
app.get('/login',(req,res)=>{if(req.session.user)return res.redirect('/dashboard');res.render('auth',{title:'Log in',mode:'login',error:null,values:{}});});
app.get('/signup',(req,res)=>{if(req.session.user)return res.redirect('/dashboard');res.render('auth',{title:'Create account',mode:'signup',error:null,values:{}});});
app.post('/signup',async(req,res,next)=>{try{const username=String(req.body.username||'').trim(),displayName=String(req.body.displayName||'').trim(),email=String(req.body.email||'').trim(),password=String(req.body.password||'');if(!username||!displayName||!password)return res.status(400).render('auth',{title:'Create account',mode:'signup',error:'Username, display name and password are required.',values:{username,displayName,email}});if(username.length<3||password.length<6)return res.status(400).render('auth',{title:'Create account',mode:'signup',error:'Username must be at least 3 characters and password at least 6 characters.',values:{username,displayName,email}});const [e]=await pool.execute('SELECT id FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1',[username]);if(e.length)return res.status(409).render('auth',{title:'Create account',mode:'signup',error:'That username is already taken.',values:{username,displayName,email}});const hash=await bcrypt.hash(password,12);const normalizedEmail=email||`${username}@savepoint.local`;const [r]=await pool.execute("INSERT INTO users (username,email,password,role) VALUES (?,?,?,'user')",[username,normalizedEmail,hash]);req.session.user={id:r.insertId,username,displayName:displayName||username,email:normalizedEmail,role:'user'};res.redirect('/dashboard');}catch(e){next(e);}});
app.post('/login',async(req,res,next)=>{try{const username=String(req.body.username||'').trim(),password=String(req.body.password||'');const [rows]=await pool.execute('SELECT id,username,password,email,role FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1',[username]);if(!rows.length||!(await bcrypt.compare(password,rows[0].password)))return res.status(401).render('auth',{title:'Log in',mode:'login',error:'Invalid username or password.',values:{username}});req.session.user=sessionUser(rows[0]);res.redirect('/dashboard');}catch(e){next(e);}});
app.post('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/login')));
app.get('/dashboard',requireLogin,async(req,res,next)=>{try{const [[a]]=await pool.query("SELECT COUNT(*) total FROM products WHERE status='active'"),[[b]]=await pool.query("SELECT COUNT(*) total FROM forum_posts WHERE status='visible'"),[[c]]=await pool.query("SELECT COUNT(*) total FROM news_items WHERE status='visible'");res.render('dashboard',{title:'Dashboard',stats:{products:Number(a.total),posts:Number(b.total),news:Number(c.total)}});}catch(e){next(e);}});
app.get('/profile',requireLogin,async(req,res,next)=>{try{const [rows]=await pool.execute('SELECT id,username,email,bio,favourite_console,profile_image,banner_image,role,created_at FROM users WHERE id=? LIMIT 1',[req.session.user.id]);if(!rows.length)return res.redirect('/logout');res.render('profile',{title:'Profile',profile:rows[0]});}catch(e){next(e);}});
app.post('/profile',requireLogin,async(req,res,next)=>{try{const username=String(req.body.username||req.session.user.username||'').trim(),email=String(req.body.email||'').trim(),bio=String(req.body.bio||'').trim(),fc=String(req.body.favouriteConsole||'').trim(),profileImage=String(req.body.profileImage||'').trim(),bannerImage=String(req.body.bannerImage||'').trim();if(!username)return res.status(400).render('error',{title:'Profile error',message:'Username cannot be empty.'});const normalizedEmail=email||req.session.user.email||`${username}@savepoint.local`;const [existing]=await pool.execute('SELECT id FROM users WHERE LOWER(username)=LOWER(?) AND id<>? LIMIT 1',[username,req.session.user.id]);if(existing.length)return res.status(409).render('error',{title:'Profile error',message:'That username is already taken.'});await pool.execute('UPDATE users SET username=?,email=?,bio=?,favourite_console=?,profile_image=?,banner_image=? WHERE id=?',[username,normalizedEmail,bio||null,fc||null,profileImage||null,bannerImage||null,req.session.user.id]);req.session.user.username=username;req.session.user.displayName=username;req.session.user.email=normalizedEmail;res.redirect('/profile');}catch(e){next(e);}});
app.get('/marketplace',requireLogin,async(req,res,next)=>{try{const [rows]=await pool.query("SELECT p.*,u.username seller_username FROM products p LEFT JOIN users u ON u.id=p.seller_user_id WHERE p.status='active' ORDER BY p.created_at DESC");res.render('placeholder',{title:'Retro Marketplace',heading:'Buy and sell retro gaming gear',description:'The marketplace table and starter listing are ready.',items:rows.map(x=>({title:x.title,detail:`${x.category}${x.platform?' · '+x.platform:''} · $${Number(x.price).toFixed(2)}`}))});}catch(e){next(e);}});
app.get('/forum',requireLogin,async(req,res,next)=>{try{const [rows]=await pool.query("SELECT f.*,u.username author_username FROM forum_posts f LEFT JOIN users u ON u.id=f.author_user_id WHERE f.status='visible' ORDER BY f.created_at DESC");res.render('placeholder',{title:'Community Forum',heading:'Discuss retro games with the community',description:'The forum table is ready for posts, comments and voting.',items:rows.map(x=>({title:x.title,detail:`Posted by ${x.author_username||'Deleted user'}`}))});}catch(e){next(e);}});
app.get('/news',(req,res)=>res.redirect('/newshub'));
app.get('/newshub',requireLogin,(req,res)=>{
  newsHub.startBackgroundRefresh();
  const initialNews=newsHub.getNewsPage({page:1,limit:6,type:req.query.type||'all',source:req.query.source||'all',selectedSources:parseSelectedNewsSources(req.query.sources)});
  res.render('newshub/index',{title:'NewsHub',initialNews,newsTypes:newsHub.NEWS_TYPES,sources:newsHub.TRUSTED_SOURCES});
});
app.get('/api/newshub/news',requireLogin,async(req,res,next)=>{try{
  if(req.query.force==='1') await newsHub.refreshArticles({force:true});
  else if(newsHub.getNewsPage({page:1,limit:1}).total===0) await newsHub.refreshArticles();
  res.json(newsHub.getNewsPage({page:req.query.page||1,limit:req.query.limit||6,type:req.query.type||'all',source:req.query.source||'all',selectedSources:parseSelectedNewsSources(req.query.sources)}));
}catch(e){next(e);}});
app.get('/api/newshub/daily-report',requireLogin,async(req,res,next)=>{try{
  if(req.query.force==='1') await newsHub.refreshArticles({force:true});
  else await newsHub.refreshArticles();
  res.json({report:newsHub.buildDailyReport(parseSelectedNewsSources(req.query.sources))});
}catch(e){next(e);}});
app.get('/api/newshub/monthly-report',requireLogin,async(req,res,next)=>{try{
  if(req.query.force==='1') await newsHub.refreshArticles({force:true});
  else await newsHub.refreshArticles();
  res.json({report:newsHub.buildMonthlyReport(parseSelectedNewsSources(req.query.sources))});
}catch(e){next(e);}});
app.get('/admin',requireAdmin,async(req,res,next)=>{try{const [users]=await pool.query('SELECT id,username,role,created_at FROM users ORDER BY created_at DESC'),[products]=await pool.query('SELECT id,title,status,created_at FROM products ORDER BY created_at DESC'),[posts]=await pool.query('SELECT id,title,status,created_at FROM forum_posts ORDER BY created_at DESC');res.render('admin',{title:'Admin Panel',users,products,posts});}catch(e){next(e);}});
app.post('/admin/products/:id/delete',requireAdmin,async(req,res,next)=>{try{await pool.execute("UPDATE products SET status='removed' WHERE id=?",[Number(req.params.id)]);res.redirect('/admin');}catch(e){next(e);}});
app.post('/admin/posts/:id/delete',requireAdmin,async(req,res,next)=>{try{await pool.execute("UPDATE forum_posts SET status='removed' WHERE id=?",[Number(req.params.id)]);res.redirect('/admin');}catch(e){next(e);}});
app.get('/health',async(req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true,database:'connected'});}catch(e){res.status(500).json({ok:false,database:'disconnected'});}});
app.use((req,res)=>res.status(404).render('error',{title:'Page not found',message:'That save file does not exist.'}));
app.use((e,req,res,next)=>{console.error(e);res.status(500).render('error',{title:'Application error',message:process.env.NODE_ENV==='production'?'SavePoint ran into an unexpected error.':e.message});});
async function startServer(){try{await pool.query('SELECT 1');console.log('Connected to MySQL database');await initialiseDatabase();await newsHub.ensureNewsHubStorage();await newsHub.hydrateCacheFromDatabase();newsHub.startBackgroundRefresh();console.log('SavePoint database tables are ready');app.listen(PORT,'0.0.0.0',()=>console.log(`SavePoint is running at http://localhost:${PORT}`));}catch(e){console.error('Could not start SavePoint:',e);process.exit(1);}}
startServer();
