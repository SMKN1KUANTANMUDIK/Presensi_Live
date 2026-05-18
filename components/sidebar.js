// =========================================
// SIDEBAR COMPONENT
// =========================================

function renderSidebar(activeMenu = ""){

  const sidebar = `

  <aside class="sidebar">

    <!-- HEADER -->
    <div class="sidebar-header">

      <div class="sidebar-logo">

        <i data-lucide="shield-check"></i>

      </div>

      <div>

        <div class="sidebar-title">
          ABSENSI
        </div>

        <div class="sidebar-subtitle">
          Premium System
        </div>

      </div>

    </div>

    <!-- MENU -->
    <div class="sidebar-menu">

      <!-- DASHBOARD -->
      <a
      href="index.html"
      class="sidebar-link ${activeMenu === 'dashboard' ? 'active' : ''}">

        <i data-lucide="layout-dashboard"></i>

        <span>
          Dashboard
        </span>

      </a>

      <!-- INPUT -->
      <a
      href="input.html"
      class="sidebar-link ${activeMenu === 'input' ? 'active' : ''}">

        <i data-lucide="clipboard-check"></i>

        <span>
          Input Absensi
        </span>

      </a>

      <!-- REPORT -->
      <a
      href="report.html"
      class="sidebar-link ${activeMenu === 'report' ? 'active' : ''}">

        <i data-lucide="file-bar-chart"></i>

        <span>
          Report Absensi
        </span>

      </a>

      <!-- PIKET -->
      <a
      href="piket.html"
      class="sidebar-link ${activeMenu === 'piket' ? 'active' : ''}">

        <i data-lucide="shield-alert"></i>

        <span>
          Dashboard Piket
        </span>

      </a>

      <!-- KEPSEK -->
      <a
      href="kepsek.html"
      class="sidebar-link ${activeMenu === 'kepsek' ? 'active' : ''}">

        <i data-lucide="chart-column"></i>

        <span>
          Dashboard Kepsek
        </span>

      </a>

      <!-- RIWAYAT -->
      <a
      href="riwayat.html"
      class="sidebar-link ${activeMenu === 'riwayat' ? 'active' : ''}">

        <i data-lucide="history"></i>

        <span>
          Riwayat Absensi
        </span>

      </a>

      <!-- USER -->
      <a
      href="guru.html"
      class="sidebar-link ${activeMenu === 'guru' ? 'active' : ''}">

        <i data-lucide="users"></i>

        <span>
          Data Guru
        </span>

      </a>

      <!-- SETTING -->
      <a
      href="setting.html"
      class="sidebar-link ${activeMenu === 'setting' ? 'active' : ''}">

        <i data-lucide="settings"></i>

        <span>
          Pengaturan
        </span>

      </a>

    </div>

    <!-- FOOTER -->
    <div
    style="
      margin-top:auto;
      padding-top:24px;
    ">

      <button
      onclick="logout()"
      class="btn btn-outline"
      style="
        width:100%;
        color:white;
        border-color:rgba(255,255,255,.12);
        background:rgba(255,255,255,.04);
      ">

        <i
        data-lucide="log-out"
        style="
          width:18px;
          height:18px;
          margin-right:8px;
        "></i>

        Logout

      </button>

    </div>

  </aside>

  `;

  document
  .getElementById("sidebarContainer")
  .innerHTML = sidebar;

  applyRoleMenu();

  lucide.createIcons();

}

// =========================================
// ROLE MENU
// =========================================

function applyRoleMenu(){

  const user =
    JSON.parse(
    localStorage.getItem("user")
    ) || {};

    const role =
    String(user.role || "")
    .toLowerCase();

  const menus =
  document.querySelectorAll(".sidebar-link");

  menus.forEach(menu=>{

    const href =
    menu.getAttribute("href");

    // ==============================
    // ADMIN
    // ==============================

    if(role === "admin"){

      menu.style.display = "flex";
      return;

    }

    // ==============================
    // GURU / WALI
    // ==============================

    if(
      role === "guru" ||
      role === "wali"
    ){

      if(
        href === "input.html" ||
        href === "report.html"
      ){

        menu.style.display = "flex";

      }else{

        menu.style.display = "none";

      }

      return;

    }

    // ==============================
    // PIKET
    // ==============================

    if(role === "piket"){

      if(
        href === "piket.html"
      ){

        menu.style.display = "flex";

      }else{

        menu.style.display = "none";

      }

      return;

    }

    // ==============================
    // KEPSEK
    // ==============================

    if(role === "kepsek"){

      if(
        href === "kepsek.html"
      ){

        menu.style.display = "flex";

      }else{

        menu.style.display = "none";

      }

    }

  });

}

// =========================================
// LOGOUT
// =========================================

function logout(){

  localStorage.clear();

  window.location.href =
  "login.html";

}