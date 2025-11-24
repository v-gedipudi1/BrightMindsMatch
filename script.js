// --- 1. CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAycejhGoOM7ha5svMqwBtVQNlrHt01A_M",
    authDomain: "brightmindsmatch.firebaseapp.com",
    projectId: "brightmindsmatch",
    storageBucket: "brightmindsmatch.firebasestorage.app",
    messagingSenderId: "1007386410464",
    appId: "1:1007386410464:web:609e1316bbf0695e0c7f85",
    measurementId: "G-Y3FHMSR84J"
};

// Initialize Firebase safely
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// --- 2. AUTH STATE LISTENER ---
auth.onAuthStateChanged(user => {
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const logoutBtn = document.getElementById('logout-btn');

    if (user) {
        if (authSection) authSection.style.display = 'none';
        if (dashboardSection) dashboardSection.style.display = 'block';
        if (logoutBtn) {
            logoutBtn.style.display = 'block';
            logoutBtn.onclick = () => {
                auth.signOut().then(() => window.location.reload());
            };
        }
        
        if (window.location.pathname.includes('tutor.html')) loadTutorProfile(user.uid);
        loadChats(user.uid);
    } else {
        if (dashboardSection) dashboardSection.style.display = 'none';
        if (authSection) authSection.style.display = 'block';
    }
});

// --- 3. AUTHENTICATION ---
function handleLogin(type) {
    const emailId = type === 'tutor' ? 'tutor-login-email' : 'stu-login-email';
    const passId = type === 'tutor' ? 'tutor-login-pass' : 'stu-login-pass';
    const btnId = type === 'tutor' ? 'tutor-login-btn' : 'stu-login-btn';
    
    const email = document.getElementById(emailId).value;
    const password = document.getElementById(passId).value;
    const btn = document.getElementById(btnId);

    if (!email || !password) return alert("Please fill in all fields.");

    if(btn) { btn.innerText = "Logging in..."; btn.disabled = true; }

    auth.signInWithEmailAndPassword(email, password)
        .then(() => console.log("Login Success"))
        .catch(err => {
            alert("Error: " + err.message);
            if(btn) { btn.innerText = "Login"; btn.disabled = false; }
        });
}

function studentSignUp() {
    const fname = document.getElementById('stu-fname').value;
    const lname = document.getElementById('stu-lname').value;
    const email = document.getElementById('stu-email').value;
    const password = document.getElementById('stu-pass').value;

    if(!fname || !lname || !email || !password) return alert("All fields required");

    auth.createUserWithEmailAndPassword(email, password).then((cred) => {
        return db.collection('users').doc(cred.user.uid).set({
            firstName: fname, lastName: lname, email: email, role: 'student'
        });
    }).then(() => alert("Student account created!")).catch(err => alert(err.message));
}

function tutorSignUp() {
    const fname = document.getElementById('tutor-fname').value;
    const lname = document.getElementById('tutor-lname').value;
    const email = document.getElementById('tutor-email').value;
    const password = document.getElementById('tutor-signup-pass').value;
    
    if(!fname || !lname || !email || !password) return alert("All fields required");

    auth.createUserWithEmailAndPassword(email, password).then((cred) => {
        return db.collection('users').doc(cred.user.uid).set({
            firstName: fname,
            lastName: lname,
            email: email,
            role: 'tutor',
            bio: '',
            education: '',
            pfp: 'https://via.placeholder.com/150'
        });
    }).then(() => {
        alert("Tutor account created successfully!");
    }).catch(err => alert("Error: " + err.message));
}

// --- 4. TUTOR PROFILE (ROBUST SAVE) ---

function loadTutorProfile(uid) {
    db.collection('users').doc(uid).get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            if(document.getElementById('tutor-bio')) document.getElementById('tutor-bio').value = data.bio || "";
            if(document.getElementById('tutor-edu')) document.getElementById('tutor-edu').value = data.education || "";
            if(document.getElementById('current-pfp') && data.pfp) document.getElementById('current-pfp').src = data.pfp;
        }
    });
}

async function saveTutorProfile() {
    const user = auth.currentUser;
    if (!user) return alert("You are not logged in!");

    const bio = document.getElementById('tutor-bio').value;
    const edu = document.getElementById('tutor-edu').value;
    const file = document.getElementById('pfp-upload').files[0];
    const saveBtn = document.getElementById('save-btn');

    saveBtn.innerText = "Saving...";
    saveBtn.disabled = true;

    try {
        // 1. Save Text Data First (Most important)
        await db.collection('users').doc(user.uid).update({
            bio: bio,
            education: edu
        });

        // 2. Try Image Upload
        if (file) {
            saveBtn.innerText = "Uploading Image...";
            const storageRef = storage.ref('pfps/' + user.uid);
            await storageRef.put(file);
            const url = await storageRef.getDownloadURL();
            
            // Save URL to Firestore
            await db.collection('users').doc(user.uid).update({ pfp: url });
            document.getElementById('current-pfp').src = url;
        }

        alert("Profile Saved!");

    } catch (error) {
        console.error("Save Error:", error);
        // If it's a storage permission error, the text still saved!
        if(error.code === 'storage/unauthorized') {
             alert("Profile Text Saved! \n\nHowever, the Image failed to upload. This is likely a 'Firebase Storage Rules' issue. Please enable Storage rules in the Firebase Console.");
        } else {
             alert("Profile Saved (Partial): " + error.message);
        }
    } finally {
        saveBtn.innerText = "Save Profile & Go Live";
        saveBtn.disabled = false;
    }
}

// --- 5. HOMEPAGE & MATCHING ---

if (document.getElementById('tutor-list')) {
    const list = document.getElementById('tutor-list');
    db.collection('users').where('role', '==', 'tutor').get().then(snapshot => {
        list.innerHTML = "";
        if(snapshot.empty) { list.innerHTML = "<p class='text-center'>No tutors found yet.</p>"; return; }
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.bio) {
                list.innerHTML += `
                <div class="col-md-4">
                    <div class="card h-100 shadow-sm">
                        <img src="${data.pfp || 'https://via.placeholder.com/150'}" class="card-img-top" style="height:200px; object-fit:cover;">
                        <div class="card-body">
                            <h5 class="card-title">${data.firstName} ${data.lastName}</h5>
                            <h6 class="text-primary mb-2">${data.education || 'Tutor'}</h6>
                            <p class="card-text text-muted">${data.bio.substring(0, 100)}...</p>
