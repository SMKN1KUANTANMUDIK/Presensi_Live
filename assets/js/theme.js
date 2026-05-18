function toggleTheme(){

document.body.classList.toggle(
'dark-mode'
);

localStorage.setItem(
'theme',
document.body.classList.contains('dark-mode')
? 'dark'
: 'light'
);

}

window.addEventListener('load',()=>{

const theme =
localStorage.getItem('theme');

if(theme === 'dark'){

document.body.classList.add(
'dark-mode'
);

}

});