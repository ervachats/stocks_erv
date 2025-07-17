// Variables globales
let excelData = [];
let imageFiles = [];
let qrReader = null;
let isSubmitting = false;
let currentAccount = null;

const localDB = new PouchDB("stocks");
const remoteDB = new PouchDB("https://admin:M,jvcmHSdl54!@couchdb.monproprecloud.fr/stocks");

localDB.sync(remoteDB, { live: true, retry: true }).on("error", console.error);

// === Gestion de la session ===
window.addEventListener("DOMContentLoaded", () => {
  currentAccount = sessionStorage.getItem('currentAccount');
  
  if (!currentAccount) {
    window.location.href = 'login.html';
    return;
  }
  
  // Mapper le code du compte à un nom lisible
  const accountNames = {
    'SCT=E260329': 'SCE Informations Sportives',
    'SCT=E272329': 'SCE Support Rédaction',
    'SCT=E370329': 'Maintenance Machines',
    'SCT=E382329': 'Service Rotatives',
    'SCT=E390329': 'Service Expédition',
    'SCT=E500329': 'Direction Vente',
    'SCT=E730329': 'LER Charges',
    'SCT=E736329': 'Service Travaux',
    'SCT=E760329': 'Achats Magasin',
    'SCT=E762329': 'Manutention Papier',
    'SCT=E772329': 'Coursiers',
    'SCT=E860329': 'Cantine',
    'NEUTRE': 'Compte Neutre'
  };
  
  document.getElementById('current-account').textContent = 
    accountNames[currentAccount] || currentAccount;
  
  document.getElementById('axe1').value = currentAccount;
  loadExcelData();
});

// === Déconnexion ===
document.getElementById('logoutBtn').addEventListener('click', () => {
  resetForm();
  sessionStorage.removeItem('currentAccount');
  window.location.href = 'login.html';
});

// === Chargement Excel ===
function loadExcelData() {
  fetch("stocker_temp.xlsx")
    .then((r) => r.arrayBuffer())
    .then((data) => {
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      excelData = XLSX.utils.sheet_to_json(sheet);
      
      const list = document.getElementById("designationList");
      list.innerHTML = '';
      
      const designations = new Set();
      
      excelData.forEach((row) => {
        const designation = row["Désignation:"] || row["Désignation"];
        if (designation && designation.trim() !== "") {
          designations.add(designation.trim());
        }
      });
      
      designations.forEach(designation => {
        const option = document.createElement("option");
        option.value = designation;
        list.appendChild(option);
      });
      
      initQRScanner();
    })
    .catch((e) => {
      console.error("Erreur chargement Excel :", e);
      alert("Erreur lors du chargement du fichier Excel");
    });
}

// === Initialisation du scanner QR ===
function initQRScanner() {
  if (Html5Qrcode.getCameras().then) {
    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length) {
          qrReader = new Html5Qrcode("qr-reader");
          qrReader.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (text) => {
              if (!isSubmitting) {
                document.getElementById("code_produit").value = text;
                
                const product = excelData.find(item => item["Code_Produit"] === text);
                if (product) {
                  document.getElementById("designation").value = product["Désignation:"] || product["Désignation"];
                  document.getElementById("designation").dispatchEvent(new Event('change'));
                }
              }
            },
            
            (err) => console.warn("QR error", err)
          ).catch((err) => console.error("QR init error", err));
        } else {
          console.log("No cameras found");
        }
      })
      .catch(err => console.error("Camera access error:", err));
  }
}

function stopQRScanner() {
  if (qrReader) {
    qrReader.stop().catch(err => console.error("Failed to stop QR scanner", err));
  }
}

// === Auto-remplissage par désignation ===
document.getElementById("designation").addEventListener("change", () => {
  const val = document.getElementById("designation").value.trim().toLowerCase();
  const match = excelData.find(
    (row) => (row["Désignation:"] || row["Désignation"] || "").toLowerCase() === val
  );

  if (!match) return;

  const map = {
    "Code_Produit": "code_produit",
    "Quantité_Consommée": "quantité_consommee",
    "unité(s)": "unites",
    "A Commander": "a_commander",
    "Remarques:": "remarques",
    "Magasin": "magasin",
    "Date de sortie": "date_sortie",
    "axe2": "axe2"
  };

  for (const [key, id] of Object.entries(map)) {
    if (match[key] !== undefined) {
      if (key === "Date de sortie") {
        const date = new Date(match[key]);
        if (!isNaN(date.getTime())) {
          document.getElementById(id).value = formatDateForInput(date);
        } else {
          document.getElementById(id).value = formatDateForInput(new Date());
        }
      } else {
        document.getElementById(id).value = match[key];
      }
    }
  }
  
  if (!match["axe2"] || match["axe2"].trim() === "") {
    document.getElementById("axe2").value = "SUP=SEMPQRLER";
  }
  
  document.getElementById("axe1").value = currentAccount;
});

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// === Gestion Photos ===
function compresserImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = (img.height / img.width) * 800;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(callback, "image/jpeg", 0.7);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function updatePhotoCount() {
  document.getElementById("photoCount").textContent = imageFiles.length;
}

function handleFiles(fileList) {
  const files = Array.from(fileList);
  if (imageFiles.length + files.length > 3) {
    alert("Maximum 3 photos !");
    return;
  }

  files.forEach((file) => {
    if (!file.type.startsWith("image/")) return;
    compresserImage(file, (blob) => {
      imageFiles.push(blob);
      const reader = new FileReader();
      reader.onload = (e) => {
        const wrapper = document.createElement("div");
        wrapper.className = "preview-image";

        const img = document.createElement("img");
        img.src = e.target.result;

        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-button";
        removeBtn.textContent = "x";

        removeBtn.addEventListener("click", () => {
          const idx = Array.from(document.getElementById("previewContainer").children).indexOf(wrapper);
          if (idx !== -1) {
            imageFiles.splice(idx, 1);
            wrapper.remove();
            updatePhotoCount();
          }
        });

        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        document.getElementById("previewContainer").appendChild(wrapper);
        updatePhotoCount();
      };
      reader.readAsDataURL(blob);
    });
  });
}

document.getElementById("cameraInput").addEventListener("change", (e) =>
  handleFiles(e.target.files)
);
document.getElementById("galleryInput").addEventListener("change", (e) =>
  handleFiles(e.target.files)
);
document.getElementById("takePhotoBtn").addEventListener("click", () =>
  document.getElementById("cameraInput").click()
);
document.getElementById("chooseGalleryBtn").addEventListener("click", () =>
  document.getElementById("galleryInput").click()
);

// === Soumission du formulaire ===
document.getElementById("stockForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  
  if (!currentAccount) {
    alert("Veuillez vous authentifier avant de soumettre le formulaire");
    return;
  }
  
  if (isSubmitting) return;
  isSubmitting = true;

  stopQRScanner();

  const form = new FormData(e.target);
  const record = { 
    _id: new Date().toISOString(), 
    photos: [],
    axe1: currentAccount
  };

  form.forEach((val, key) => {
    if (key === "date_sortie") {
      record[key] = new Date(val).toISOString();
    } else {
      record[key] = val;
    }
  });

  if (imageFiles.length > 0) {
    for (const file of imageFiles) {
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      record.photos.push(base64);
    }
  }

  try {
    await localDB.put(record);
    alert("Stock enregistré !");
    resetForm();
  } catch (err) {
    console.error("Erreur sauvegarde :", err);
    alert("Erreur lors de l'enregistrement.");
  } finally {
    isSubmitting = false;
    initQRScanner();
  }
});

// === Réinitialisation du formulaire ===
function resetForm() {
  document.getElementById("stockForm").reset();
  imageFiles = [];
  document.getElementById("previewContainer").innerHTML = "";
  updatePhotoCount();
  document.getElementById("code_produit").value = "";
  document.getElementById("designation").value = "";
  document.getElementById("axe1").value = currentAccount;
  document.getElementById("axe2").value = "SUP=SEMPQRLER";
}

// === Bouton de réinitialisation ===
document.getElementById("resetBtn").addEventListener("click", () => {
  if (confirm("Voulez-vous vraiment réinitialiser le formulaire ?")) {
    resetForm();
  }
});