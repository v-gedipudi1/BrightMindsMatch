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
    const password = document.getElementById('tutor-signup-pass').value; // NEW: Get password from input
    
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

// --- 4. TUTOR PROFILE (FIXED SAVING ISSUE) ---

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

// NEW ASYNC SAVE FUNCTION
async function saveTutorProfile() {
    const user = auth.currentUser;
    if (!user) return alert("You are not logged in!");

    const bio = document.getElementById('tutor-bio').value;
    const edu = document.getElementById('tutor-edu').value;
    const file = document.getElementById('pfp-upload').files[0];
    const saveBtn = document.getElementById('save-btn');

    // UI Feedback
    saveBtn.innerText = "Saving...";
    saveBtn.disabled = true;

    try {
        let photoURL = null;

        // 1. Upload Image if exists
        if (file) {
            const storageRef = storage.ref('pfps/' + user.uid);
            await storageRef.put(file);
            photoURL = await storageRef.getDownloadURL();
        }

        // 2. Prepare Data
        const updateData = {
            bio: bio,
            education: edu
        };
        if (photoURL) updateData.pfp = photoURL;

        // 3. Update Firestore
        await db.collection('users').doc(user.uid).update(updateData);
        
        alert("Profile Saved Successfully!");

    } catch (error) {
        console.error("Save Error:", error);
        // This will tell you exactly why it's failing
        alert("Error saving profile: " + error.message + "\n\nTip: If this is a permission error, check your Firebase Storage Rules.");
    } finally {
        // Always reset button
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
                        </div>
                    </div>
                </div>`;
            }
        });
    });
}

function runAIMatch() {
    const promptInput = document.getElementById('ai-prompt');
    const resultsDiv = document.getElementById('match-results');
    
    if(!promptInput.value) { alert("Please describe your needs."); return; }

    resultsDiv.innerHTML = "<div class='text-center p-3'>Scanning...</div>";
    const keywords = promptInput.value.toLowerCase().split(' ').filter(w => w.length > 3); 

    db.collection('users').where('role', '==', 'tutor').get().then(snapshot => {
        let scoredTutors = [];
        snapshot.forEach(doc => {
            const tutor = doc.data();
            let score = 0;
            if (tutor.bio && tutor.education) {
                const text = (tutor.bio + " " + tutor.education).toLowerCase();
                keywords.forEach(word => { if (text.includes(word)) score += 10; });
                score += Math.random(); 
                scoredTutors.push({ ...tutor, id: doc.id, score: score });
            }
        });

        scoredTutors.sort((a, b) => b.score - a.score);
        resultsDiv.innerHTML = "";
        
        if(scoredTutors.length === 0) { resultsDiv.innerHTML = "<div class='alert alert-warning'>No matches found.</div>"; return; }

        scoredTutors.slice(0, 5).forEach(t => {
            resultsDiv.innerHTML += `
            <a href="#" onclick="startChat('${t.id}', '${t.firstName}')" class="list-group-item list-group-item-action">
                <div class="d-flex justify-content-between">
                    <h5 class="mb-1">${t.firstName} ${t.lastName}</h5>
                    <span class="badge bg-success">Match</span>
                </div>
                <p class="mb-1 small text-muted">${t.education}</p>
                <small class="text-primary">Click to Chat</small>
            </a>`;
        });
    });
}

// --- 6. CHAT ---
function startChat(otherId, otherName) {
    const user = auth.currentUser;
    if(!user) return;
    const chatId = [user.uid, otherId].sort().join('_');
    
    db.collection('chats').doc(chatId).set({
        participants: [user.uid, otherId],
        participantNames: firebase.firestore.FieldValue.arrayUnion(otherName),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(() => {
        window.location.href = `chat.html?id=${chatId}&name=${otherName}`;
    });
}

function loadChats(uid) {
    const list = document.getElementById('chat-list');
    if(!list) return;

    db.collection('chats').where('participants', 'array-contains', uid).orderBy('lastUpdated', 'desc').onSnapshot(snap => {
        list.innerHTML = "";
        if(snap.empty) { list.innerHTML = "<div class='p-3 text-muted'>No chats yet.</div>"; return; }
        snap.forEach(doc => {
            list.innerHTML += `<a href="chat.html?id=${doc.id}" class="list-group-item list-group-item-action">Open Chat</a>`;
        });
    });
}

if (window.location.pathname.includes('chat.html')) {
    const params = new URLSearchParams(window.location.search);
    const chatId = params.get('id');
    const chatName = params.get('name');
    if(chatName) document.getElementById('chat-header').innerText = "Chat with " + chatName;

    if(chatId) {
        db.collection('chats').doc(chatId).collection('messages').orderBy('timestamp').onSnapshot(snap => {
            const box = document.getElementById('messages-box');
            box.innerHTML = "";
            snap.forEach(doc => {
                const d = doc.data();
                const isMe = d.sender === auth.currentUser?.uid;
                box.innerHTML += `<div class="${isMe ? 'text-end' : 'text-start'} mb-2"><span class="d-inline-block p-2 rounded ${isMe ? 'bg-primary text-white' : 'bg-secondary text-white'}">${d.text}</span></div>`;
            });
            box.scrollTop = box.scrollHeight;
        });
    }
}

function sendMessage() {
    const text = document.getElementById('msg-input').value;
    const chatId = new URLSearchParams(window.location.search).get('id');
    if(text && chatId) {
        db.collection('chats').doc(chatId).collection('messages').add({
            text: text, sender: auth.currentUser.uid, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        db.collection('chats').doc(chatId).update({ lastUpdated: firebase.firestore.FieldValue.serverTimestamp() });
        document.getElementById('msg-input').value = "";
    }
}
