// =========================================
// NAVBAR COMPONENT
// =========================================

const user =
JSON.parse(
  localStorage.getItem("user")
) || {};

const username =
user.nama_guru || "User";

const role =
user.role || "guest";

function renderNavbar(title = "Dashboard"){

  const username =
  localStorage.getItem("nama") ||
  "User";

  const role =
  localStorage.getItem("role") ||
  "guest";

  const navbar = `

  <header class="navbar">

    <!-- LEFT -->
    <div class="navbar-left">

      <!-- MOBILE TOGGLE -->
      <button
      class="mobile-toggle"
      onclick="toggleSidebar()">

        <i data-lucide="menu"></i>

      </button>

      <!-- TITLE -->
      <div>

        <div class="navbar-title">
          ${title}
        </div>

        <div class="navbar-subtitle">

          Selamat datang,
          ${username}

        </div>

      </div>

    </div>

    <!-- RIGHT -->
    <div class="navbar-right">

      <!-- DARK MODE -->
      <button
      class="btn btn-outline"
      onclick="toggleTheme()"
      title="Dark Mode">

        <i
        data-lucide="moon-star"
        style="
          width:18px;
          height:18px;
        "></i>

      </button>

      <!-- ROLE -->
      <div
      class="badge badge-success"
      style="
        text-transform:uppercase;
        letter-spacing:.5px;
      ">

        ${role}

      </div>

      <!-- PROFILE -->
      <div
      style="
        display:flex;
        align-items:center;
        gap:12px;
      ">

        <div
        style="
          text-align:right;
        ">

          <div
          style="
            font-size:14px;
            font-weight:700;
          ">

            ${username}

          </div>

          <div
          style="
            font-size:12px;
            color:var(--text-soft);
          ">

            Sistem Absensi

          </div>

        </div>

        <div
        style="
          width:46px;
          height:46px;
          border-radius:16px;
          background:var(--primary);
          color:white;
          display:flex;
          align-items:center;
          justify-content:center;
          font-weight:800;
          font-size:16px;
        ">

          ${username.charAt(0).toUpperCase()}

        </div>

      </div>

    </div>

  </header>

  `;

  document
  .getElementById("navbarContainer")
  .innerHTML = navbar;

  lucide.createIcons();

}

// =========================================
// MOBILE SIDEBAR
// =========================================

function toggleSidebar(){

  document.body.classList.toggle(
    "sidebar-open"
  );

}

// =========================================
// AUTO CLOSE MOBILE
// =========================================

document.addEventListener(
  "click",
  function(e){

    const sidebar =
    document.querySelector(".sidebar");

    const toggle =
    document.querySelector(".mobile-toggle");

    if(
      window.innerWidth <= 1000 &&
      document.body.classList.contains(
        "sidebar-open"
      )
    ){

      if(
        sidebar &&
        !sidebar.contains(e.target) &&
        toggle &&
        !toggle.contains(e.target)
      ){

        document.body.classList.remove(
          "sidebar-open"
        );

      }

    }

  }
);

// =========================================
// ESC CLOSE
// =========================================

document.addEventListener(
  "keydown",
  function(e){

    if(e.key === "Escape"){

      document.body.classList.remove(
        "sidebar-open"
      );

    }

  }
);

