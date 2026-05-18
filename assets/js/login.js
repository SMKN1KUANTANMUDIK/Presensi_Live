const API_URL =
"https://script.google.com/macros/s/AKfycbyxnWriL3KepYRmn8XKwxLQCGcj1JB_gNcXIPH_KluOrfu02aXz2_h9hkBOj2aG2wc/exec";

async function login(){

  const username =
  document.getElementById("username").value.trim();

  const password =
  document.getElementById("password").value.trim();

  const errorBox =
  document.getElementById("errorBox");

  const loading =
  document.getElementById("loading");

  errorBox.style.display = "none";

  // =========================
  // VALIDASI
  // =========================

  if(!username || !password){

    errorBox.style.display =
    "block";

    errorBox.innerText =
    "Username dan password wajib diisi";

    return;

  }

  try{

    loading.style.display =
    "block";

    // =========================
    // FETCH LOGIN
    // =========================

    const response =
    await fetch(

      API_URL +

      "?action=login" +

      "&username=" +
      encodeURIComponent(username) +

      "&password=" +
      encodeURIComponent(password)

    );

    const data =
    await response.json();

    console.log("DATA LOGIN:");
    console.log(data);

    console.log("USER:");
    console.log(data.user);

    // =========================
    // VALIDASI LOGIN
    // =========================

    if(!data.success){

      errorBox.style.display =
      "block";

      errorBox.innerText =
      data.error || "Login gagal";

      return;

    }

    // =========================
    // SIMPAN SESSION
    // =========================

    localStorage.setItem(

      "isLogin",
      "true"

    );

    localStorage.setItem(

      "user",

      JSON.stringify(data.user)

    );

    // =========================
    // SIMPAN USER DATA
    // =========================

    localStorage.setItem(

      "userData",

      JSON.stringify({

        nama:
        data.user.nama_guru || "-",

        mapel:
        data.user.mapel || "-",

        role:
        data.user.role || "-",

        nip:
        data.user.nip || "-"

      })

    );

    console.log(
      "USER DATA TERSIMPAN:"
    );

    console.log(

      JSON.parse(
        localStorage.getItem("userData")
      )

    );

    // =========================
    // REDIRECT ROLE
    // =========================

    const role =
    String(data.user.role || "")
    .trim()
    .toLowerCase();

    if(role === "admin"){

      window.location.href =
      "admin.html";

    }

    else if(role === "kepsek"){

      window.location.href =
      "kepsek.html";

    }

    else if(role === "piket"){

      window.location.href =
      "piket.html";

    }

    else if(
      role === "guru" ||
      role === "wali"
    ){

      window.location.href =
      "input.html";

    }

    else{

      errorBox.style.display =
      "block";

      errorBox.innerText =
      "Role tidak dikenali";

    }

  }catch(err){

    console.error(err);

    errorBox.style.display =
    "block";

    errorBox.innerText =
    "Gagal terhubung ke server";

  }finally{

    loading.style.display =
    "none";

  }

}