> 🔗 Official repository: https://github.com/VeltrixJS/Azarlive-IP-Scanner

<div align="center">

‎ 
### 🎥 [VOIR LE TUTORIEL VIDÉO](https://veltrixjs.github.io/Azarlive-IP-Scanner/)

‎ 
</div>

---

# 🔍 Azar IP Scanner — v4.0

Un script puissant pour analyser les adresses IP en temps réel sur [Azar](https://azarlive.com/) Live, avec géolocalisation multi-API, fusion intelligente des coordonnées et indice de confiance.

---

<div align="center">

###  Installation 

[![Installer le script](https://img.shields.io/badge/INSTALLER-Azar_IP_Scanner-51f59b?style=for-the-badge&logo=tampermonkey&logoColor=black)](https://raw.githubusercontent.com/VeltrixJS/Azarlive-IP-Scanner/main/ip-scanner.user.js)

*Nécessite [Tampermonkey](https://www.tampermonkey.net/) installé dans ton navigateur.*

</div>

---

## ✨ Fonctionnalités

- 🎯 Détection automatique d'IP via WebRTC (hook `RTCPeerConnection`)
- 🌍 Géolocalisation multi-API avec **fusion géométrique** (geometric median)
- 📊 **Badge de confiance** (HIGH / MED / LOW) avec marge d'erreur en km
- 🚨 Détection VPN / Proxy / Hosting
- 🗺️ Localisation Google Maps
- 📍 Bouton **"Me"** — compare la position détectée avec ta position réelle
- 📜 **Historique** des 10 dernières IPs (cliquable pour remonter en tête)
- 📡 **Ping** vers l'IP détectée (RTT en ms, code couleur)
- 📺 Mode **double écran** (popup synchronisée)
- 📋 Copie instantanée d'IP
- 🔒 Filtrage strict des IPs privées / réservées (RFC 1918, CGNAT, link-local, loopback, multicast…)
- 🧬 Support IPv4 **et** IPv6
- 🛡️ **Rate limiting** (60 lookups/min) + déduplication des IPs en cours de traitement

---

## 🚀 Installation

### Prérequis : installer Tampermonkey

- [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox](https://addons.mozilla.org/fr/firefox/addon/tampermonkey/)
- [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### Installation du script

**Option A — 1 clic (recommandé)** :

👉 [**Cliquer ici pour installer**](https://raw.githubusercontent.com/VeltrixJS/Azarlive-IP-Scanner/main/ip-scanner.user.js) → Tampermonkey ouvre une page d'installation → clique sur **Installer**.

**Option B — Manuellement** :

1. Clique sur l'icône Tampermonkey → **"Créer un nouveau script"**
2. Supprime tout le contenu par défaut
3. Copie-colle le contenu de [`ip-scanner.user.js`](https://raw.githubusercontent.com/VeltrixJS/Azarlive-IP-Scanner/main/ip-scanner.user.js)
4. Sauvegarde (**Ctrl+S** ou **Cmd+S**)

### Vérification (Chrome)

Ouvre la page des extensions :
```
     chrome://extensions/?id=dhdgffkkebhmkfjojejmpbldmpobfkfo
```
   - Dans les paramètres de Tampermonkey, vérifie que :
     - ✅ La case « Autoriser les scripts utilisateurs » est cochée
     - ✅ Le « Mode développeur » est activé (interrupteur en haut à droite de la page)
   - Le script s'active automatiquement après installation

4. **Utiliser**
   - Rendez-vous sur [azarlive.com](https://azarlive.com/)
   - Le panneau apparaît automatiquement en haut à droite
   - Lancez un appel → L'IP s'affiche automatiquement

## 🔧 APIs utilisées

Le script interroge **3 APIs en parallèle** (race condition) et fusionne les résultats :

1. **ipwho.is** → géolocalisation + ISP + détection VPN/Proxy/Hosting + ASN + drapeau
2. **freeipapi.com** → géolocalisation + détection Proxy
3. **techniknews.net** → géolocalisation + timezone (IPv4 uniquement)

### 🔁 Reverse geocoding

- **nominatim.openstreetmap.org** → affinage ville / quartier / code postal à partir des coordonnées fusionnées

### 📐 Fusion des coordonnées

Quand plusieurs APIs renvoient des coordonnées différentes, le script :
1. Filtre les points aberrants (via une première passe de **geometric median**)
2. Applique un filtre basé sur le **RTT du ping** (limite la distance max plausible)
3. Calcule le **geometric median** final
4. Calcule l'écart médian (**spread**) pour attribuer un **niveau de confiance** :
   - 🎯 **HIGH** : ≥ 3 sources, spread < 30 km
   - ◐ **MED** : ≥ 2 sources, spread < 150 km
   - ⚠️ **LOW** : sinon

> **💡 Système de fallback** : si une API ne répond pas dans les 4s → ignorée automatiquement. Aucune clé API requise.

---

## 📡 Détection du ping

Le script tente de charger un favicon depuis l'IP détectée pour estimer le **RTT (aller-retour)** :

- `< 100 ms` → 🟢 vert
- `< 300 ms` → 🟡 jaune
- `≥ 300 ms` → 🔴 rouge

Ce ping est ensuite utilisé pour filtrer les localisations géographiquement impossibles.

## 📖 Utilisation

### Contrôles

| Bouton | Action |
|--------|--------|
| **📜** | Affiche/masque l'historique des 10 dernières IPs |
| **📺 POPUP** | Ouvre une fenêtre popup pour monitoring sur second écran |
| **X** | Minimise l'interface en icône déplaçable |
| **Copy** | Copie l'adresse IP dans le presse-papier |
| **Maps** | Ouvre la localisation dans Google Maps |
| **📍 Me** | Compare la position détectée avec ta position GPS réelle |
| **🗑️ CLEAR** | Vide l'historique (garde l'IP courante) |

### 💡 Icône minimisée

- Cliquez sur **X** pour minimiser le panneau
- Une icône apparaît et reste déplaçable
- Cliquez sur l'icône pour rouvrir le panneau au même endroit

### 📜 Historique

- Cliquez sur **📜** pour afficher les 10 dernières IPs
- Cliquez sur une entrée de l'historique pour la remonter en tête de liste

---

## 📷 Aperçu

### Interface principale
<img width="424" height="318" alt="image" src="https://github.com/user-attachments/assets/bb92389f-16ca-479e-8e6c-950652cbabe7" />

### Pop-up second écran
<img width="431" height="454" alt="image" src="https://github.com/user-attachments/assets/6d5ec5fc-60b7-4179-8c5d-585dae887126" />

---

## ⚖️ Avertissement légal

Ce projet est fourni **à des fins éducatives et de recherche uniquement**.

- L'auteur n'est pas responsable de l'utilisation abusive de ce script.
- L'utilisation peut être contraire aux conditions d'utilisation d'Azar.
- Respectez les lois locales sur la vie privée et le consentement.

‎ ‎ 
<div align="center">
Made with ❤️ by VeltrixJS
⭐ Star si vous aimez !
</div>




