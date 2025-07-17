// Gestion de la connexion pour tous les comptes
const accountMappings = {
  'btn-info-sport': 'SCT=E260329',
  'btn-support-redac': 'SCT=E272329',
  'btn-maintenance': 'SCT=E370329',
  'btn-rotatives': 'SCT=E382329',
  'btn-expedition': 'SCT=E390329',
  'btn-direction': 'SCT=E500329',
  'btn-ler': 'SCT=E730329',
  'btn-travaux': 'SCT=E736329',
  'btn-achats': 'SCT=E760329',
  'btn-manutention': 'SCT=E762329',
  'btn-coursiers': 'SCT=E772329',
  'btn-cantine': 'SCT=E860329',
  'btn-neutre': 'Invite'
};

// Ajout des écouteurs pour tous les boutons
Object.keys(accountMappings).forEach(btnId => {
  const btn = document.getElementById(btnId);
  if (btn) {
    btn.addEventListener('click', () => {
      sessionStorage.setItem('currentAccount', accountMappings[btnId]);
      window.location.href = 'index.html';
    });
  }
});

// Animation au chargement de la page
window.addEventListener('DOMContentLoaded', () => {
  const accountButtons = document.querySelectorAll('.account-btn');
  
  // Animation d'apparition des boutons
  setTimeout(() => {
    accountButtons.forEach((btn, index) => {
      setTimeout(() => {
        btn.style.opacity = '1';
        btn.style.transform = 'translateY(0)';
      }, 100 * index);
    });
  }, 500);
  
  // Initialiser les styles pour l'animation
  accountButtons.forEach(btn => {
    btn.style.opacity = '0';
    btn.style.transform = 'translateY(20px)';
    btn.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  });
});
