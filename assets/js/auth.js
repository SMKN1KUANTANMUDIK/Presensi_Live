const role =
localStorage.getItem(
  'userRole'
);

const isLogin =
localStorage.getItem(
  'isLogin'
);

if(!isLogin){

  location.href =
  'login.html';

}

// =====================================
// PAGE ACCESS
// =====================================

const page =
location.pathname
.split('/')
.pop();

// ADMIN ONLY
const adminPages = [

  'admin.html',
  'riwayat.html'

];

// KEPSEK
const kepsekPages = [

  'kepsek.html'

];

// PIKET
const piketPages = [

  'piket.html'

];

// GURU
const guruPages = [

  'input.html',
  'report.html'

];

// =====================================
// CHECK ACCESS
// =====================================

function deny(){

  alert(
    'Akses ditolak'
  );

  history.back();

}

if(

  adminPages.includes(page)

  &&

  role !== 'admin'

){

  deny();

}

if(

  kepsekPages.includes(page)

  &&

  role !== 'kepsek'

  &&

  role !== 'admin'

){

  deny();

}

if(

  piketPages.includes(page)

  &&

  role !== 'piket'

  &&

  role !== 'admin'

){

  deny();

}

if(

  guruPages.includes(page)

  &&

  !['guru','wali','admin']
  .includes(role)

){

  deny();

}