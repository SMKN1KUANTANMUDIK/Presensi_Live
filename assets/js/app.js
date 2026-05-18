function getUser(){

  const data =
  localStorage.getItem(
    "user"
  );

  if(!data){

    return null;

  }

  return JSON.parse(data);

}

// ======================================
// USER ACTIVE
// ======================================

const USER = getUser();

// ======================================
// INIT LAYOUT
// ======================================

function initLayout(
  activeMenu,
  title
){

  renderSidebar(
    activeMenu
  );

  renderNavbar(
    title
  );

}

// ======================================
// LOGOUT
// ======================================

function logout(){

  localStorage.clear();

  location.href =
  "index.html";

}

// ======================================
// ROLE CHECK
// ======================================

function hasRole(...roles){

  if(!USER){

    return false;

  }

  return roles.includes(
    USER.role
  );

}