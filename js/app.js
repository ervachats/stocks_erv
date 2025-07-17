// Variables globales
let excelData = [];
let imageFiles = [];
let qrReader = null;
let isSubmitting = false;
let currentAccount = null;

const localDB = new PouchDB("stocks");
const remoteDB = new PouchDB("https://admin:M,jvcmHSdl54!@couchdb.monproprecloud.fr/stocks");

localDB.sync(remoteDB, { live: true, retry: true }).on("error", console.error);

// Fonction utilitaire pour la date
function formatToDateTimeLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function updateSortieDate() {
  document.getElementById("date_sortie").value = formatToDateTimeLocal(new Date());
}

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
    'Invite': 'Compte Invite'  // Changé de 'NEUTRE' à 'Invite' pour correspondre à login.js
  };
  
  document.getElementById('currentUserLabel').textContent = 
    accountNames[currentAccount] || currentAccount;
  
  document.getElementById('axe1').value = currentAccount === 'Invite' ? 'NEUTRE' : currentAccount;
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
      
      const designationList = document.getElementById("designationList");
      designationList.innerHTML = '';
      
      const codeList = document.getElementById("codeProduitList");
      codeList.innerHTML = '';
      
      const designations = new Set();
      const codes = new Set();
      
      excelData.forEach((row) => {
        // Pour les désignations
        const designation = row["Désignation:"] || row["Désignation"];
        if (designation !== undefined && designation !== null) {
          const designationStr = String(designation).trim();
          if (designationStr !== "") {
            designations.add(designationStr);
          }
        }
        
        // Pour les codes produits
        const code = row["Code_Produit"];
        if (code !== undefined && code !== null) {
          const codeStr = String(code).trim();
          if (codeStr !== "") {
            codes.add(codeStr);
          }
        }
      });
      
      // Remplir le datalist des désignations
      designations.forEach(designation => {
        const option = document.createElement("option");
        option.value = designation;
        designationList.appendChild(option);
      });
      
      // Remplir le datalist des codes produits
      codes.forEach(code => {
        const option = document.createElement("option");
        option.value = code;
        codeList.appendChild(option);
      });
      
      initQRScanner();
      setupEventListeners();
      resetForm(); // Initialise le formulaire avec la date du jour
    })
    .catch((e) => {
      console.error("Erreur chargement Excel :", e);
      alert("Erreur lors du chargement du fichier Excel");
    });
}

// === Remplissage du formulaire à partir des données Excel ===
function fillFormFromExcel(match) {
  const map = {
    "Code_Produit": "code_produit",
    "Désignation:": "designation",
    "Désignation": "designation",
    "Quantité_Consommée": "quantité_consommee",
    "unité(s)": "unites",
    "A Commander": "a_commander",
    "Remarques:": "remarques",
    "Magasin": "magasin",
    "axe2": "axe2"
  };

  for (const [excelKey, formId] of Object.entries(map)) {
    if (match[excelKey] !== undefined) {
      document.getElementById(formId).value = match[excelKey];
    }
  }

  if (!match["axe2"] || match["axe2"].trim() === "") {
    document.getElementById("axe2").value = "SUP=SEMPQRLER";
  }

  document.getElementById("axe1").value = currentAccount;
  updateSortieDate(); // Met à jour la date quand on remplit via Excel
}

function setupEventListeners() {
  // Écouteur pour le champ code_produit
  document.getElementById("code_produit").addEventListener("input", function() {
    const codeValue = String(this.value).trim().toLowerCase();
    if (codeValue) {
      const match = excelData.find(
        (row) => (row["Code_Produit"] || "").toString().toLowerCase() === codeValue
      );
      if (match) {
        fillFormFromExcel(match);
      } else {
        updateSortieDate(); // Mise à jour date si saisie manuelle
      }
    } else {
      updateSortieDate(); // Mise à jour date si champ vidé
    }
  });

  // Écouteur pour le champ designation
  document.getElementById("designation").addEventListener("input", function() {
    const val = String(this.value).trim().toLowerCase();
    const match = excelData.find(
      (row) => (row["Désignation:"] || row["Désignation"] || "").toLowerCase() === val
    );
    if (match) {
      fillFormFromExcel(match);
    } else {
      updateSortieDate(); // Mise à jour date si saisie manuelle
    }
  });

  // Autres écouteurs existants...
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
                  fillFormFromExcel(product);
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

// Écouteurs pour les boutons photo
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
  updateSortieDate(); // Initialise la date du jour
}

// === Bouton de réinitialisation ===
document.getElementById("resetBtn").addEventListener("click", () => {
  if (confirm("Voulez-vous vraiment réinitialiser le formulaire ?")) {
    resetForm();
  }
});