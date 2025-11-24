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

// --- 2. AUTH STATE LISTENER (CRITICAL FOR REDIRECTS) ---
auth.onAuthStateChanged(user => {
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const logoutBtn = document.getElementById('logout-btn');

    if (user) {
        console.log("User is signed in:", user.email);
        
        // 1. Switch UI to Dashboard
        if (authSection) authSection.style.display = 'none';
        if (dashboardSection) dashboardSection.style.display = 'block';
        
        // 2. Show Logout Button
        if (logoutBtn) {
            logoutBtn.style.display = 'block';
            logoutBtn.onclick = () => {
                auth.signOut().then(() => {
                    alert("Logged out successfully.");
                    window.location.reload();
                });
            };
        }
        
        // 3. Load Data based on page
        if (window.location.pathname.includes('tutor.html')) {
            loadTutorProfile(user.uid);
        }
        loadChats(user.uid);
        
    } else {
        console.log("No user signed in.");
        // Ensure dashboard is hidden if not logged in
        if (dashboardSection) dashboardSection.style.display = 'none';
        if (authSection) authSection.style.display = 'block';
    }
});

// --- 3. AUTHENTICATION FUNCTIONS ---

function handleLogin(type) {
    const emailId = type === 'tutor' ? 'tutor-login-email' : 'stu-login-email';
    const passId = type === 'tutor' ? 'tutor-login-pass' : 'stu-login-pass';
    const btnId = type === 'tutor' ? 'tutor-login-btn' : 'stu-login-btn'; // Ensure buttons have IDs
    
    const email = document.getElementById(emailId).value;
    const password = document.getElementById(passId).value;
    const btn = document.getElementById(btnId);

    if (!email || !password) {
        alert("Please enter both email and password.");
        return;
    }

    // UI Feedback
    if(btn) {
        btn.innerText = "Logging in...";
        btn.disabled = true;
    }

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            // Success: onAuthStateChanged will handle the redirect
            console.log("Login success");
        })
        .catch(err => {
            alert("Login Failed: " + err.message);
            if(btn) {
                btn.innerText = "Login";
                btn.disabled = false;
            }
        });
}

function studentSignUp() {
    const fname = document.getElementById('stu-fname').value;
    const lname = document.getElementById('stu-lname').value;
    const email = document.getElementById('stu-email').value;
    const password = document.getElementById('stu-pass').value;
    const btn = document.getElementById('stu-signup-btn');

    if(!fname || !lname || !email || !password) {
        alert("Please fill in all fields");
        return;
    }

    if(btn) btn.innerText = "Creating Account...";

    auth.createUserWithEmailAndPassword(email, password).then((cred) => {
        return db.collection('users').doc(cred.user.uid).set({
            firstName: fname,
            lastName: lname,
            email: email,
            role: 'student'
        });
    }).then(() => {
        alert("Account created! You are now logged in.");
    }).catch(err => {
        alert("Error: " + err.message);
        if(btn) btn.innerText = "Sign Up";
    });
}

function tutorSignUp() {
    const fname = document.getElementById('tutor-fname').value;
    const lname = document.getElementById('tutor-lname').value;
    const email = document.getElementById('tutor-email').value;
    
    if(!fname || !lname || !email) {
        alert("Please fill in all fields");
        return;
    }

    const password = fname + "2025!"; 

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
        alert("Tutor account created! Password: " + password);
    }).catch(err => alert("Error: " + err.message));
}

// --- 4. TUTOR PROFILE & HOME LIST ---

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

function saveTutorProfile() {
    const user = auth.currentUser;
    if (!user) return;

    const bio = document.getElementById('tutor-bio').value;
    const edu = document.getElementById('tutor-edu').value;
    const file = document.getElementById('pfp-upload').files[0];
    const saveBtn = document.getElementById('save-btn');

    saveBtn.innerText = "Saving...";
    saveBtn.disabled = true;

    const updateFirestore = (url) => {
        let updateData = { bio: bio, education: edu };
        if(url) updateData.pfp = url;

        db.collection('users').doc(user.uid).update(updateData).then(() => {
            alert("Profile Saved!");
            saveBtn.innerText = "Save Profile & Go Live";
            saveBtn.disabled = false;
        }).catch(err => {
            alert("Error: " + err.message);
            saveBtn.disabled = false;
        });
    };

    if (file) {
        const storageRef = storage.ref('pfps/' + user.uid);
        storageRef.put(file).then(snapshot => snapshot.ref.getDownloadURL())
            .then(url => {
                document.getElementById('current-pfp').src = url;
                updateFirestore(url);
            });
    } else {
        updateFirestore(null);
    }
}

// Check for Home Page List
if (document.getElementById('tutor-list')) {
    const list = document.getElementById('tutor-list');
    db.collection('users').where('role', '==', 'tutor').get().then(snapshot => {
        list.innerHTML = "";
        if(snapshot.empty) {
            list.innerHTML = "<p class='text-center'>No tutors found yet.</p>";
            return;
        }
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

// --- 5. AI MATCHING ---
function runAIMatch() {
    const promptInput = document.getElementById('ai-prompt');
    const resultsDiv = document.getElementById('match-results');
    
    if(!promptInput.value) { alert("Please describe what you need help with."); return; }

    resultsDiv.innerHTML = "<div class='text-center p-3'>Scanning...</div>";
    
    const keywords = promptInput.value.toLowerCase().split(' ').filter(w => w.length > 3); 

    db.collection('users').where('role', '==', 'tutor').get().then(snapshot => {
        let scoredTutors = [];
        snapshot.forEach(doc => {
            const tutor = doc.data();
            let score = 0;
            // Simple keyword matching
            if (tutor.bio && tutor.education) {
                const text = (tutor.bio + " " + tutor.education).toLowerCase();
                keywords.forEach(word => { if (text.includes(word)) score += 10; });
                score += Math.random(); 
                scoredTutors.push({ ...tutor, id: doc.id, score: score });
            }
        });

        scoredTutors.sort((a, b) => b.score - a.score);
        resultsDiv.innerHTML = "";
        
        if(scoredTutors.length === 0) {
            resultsDiv.innerHTML = "<div class='alert alert-warning'>No matches found. Try different keywords.</div>";
            return;
        }

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

// --- 6. CHAT FUNCTIONALITY ---
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
        if(snap.empty) { list.innerHTML = "<div class='p-3 text-muted text-center'>No active chats.</div>"; return; }
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
                box.innerHTML += `
                <div class="${isMe ? 'text-end' : 'text-start'} mb-2">
                    <span class="d-inline-block p-2 rounded ${isMe ? 'bg-primary text-white' : 'bg-secondary text-white'}" style="max-width:75%;">
                        ${d.text}
                    </span>
                </div>`;
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
