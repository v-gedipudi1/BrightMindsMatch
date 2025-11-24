// --- 1. CONFIGURATION ---
const firebaseConfig = {
    // PASTE YOUR FIREBASE CONFIG HERE
    apiKey: "AIzaSyD...",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// --- 2. AUTHENTICATION LOGIC ---

// Tutor Sign Up
function tutorSignUp() {
    const fname = document.getElementById('tutor-fname').value;
    const lname = document.getElementById('tutor-lname').value;
    const email = document.getElementById('tutor-email').value;
    const password = fname + "2025!"; // Enforced password logic

    auth.createUserWithEmailAndPassword(email, password).then((cred) => {
        // Create User Document
        return db.collection('users').doc(cred.user.uid).set({
            firstName: fname,
            lastName: lname,
            email: email,
            role: 'tutor',
            bio: '',
            education: '',
            pfp: 'https://via.placeholder.com/150' // Default PFP
        });
    }).then(() => {
        alert("Tutor account created! Password is: " + password);
        location.reload();
    }).catch(err => alert(err.message));
}

// Student Sign Up
function studentSignUp() {
    const fname = document.getElementById('stu-fname').value;
    const lname = document.getElementById('stu-lname').value;
    const email = document.getElementById('stu-email').value;
    const password = document.getElementById('stu-pass').value; // Custom password

    auth.createUserWithEmailAndPassword(email, password).then((cred) => {
        return db.collection('users').doc(cred.user.uid).set({
            firstName: fname,
            lastName: lname,
            email: email,
            role: 'student'
        });
    }).then(() => {
        alert("Student account created!");
        location.reload();
    }).catch(err => alert(err.message));
}

// Login Functions
function tutorLogin() {
    const e = document.getElementById('tutor-login-email').value;
    const p = document.getElementById('tutor-login-pass').value;
    auth.signInWithEmailAndPassword(e, p).then(() => alert("Welcome Back!")).catch(err => alert(err.message));
}

function studentLogin() {
    const e = document.getElementById('stu-login-email').value;
    const p = document.getElementById('stu-login-pass').value;
    auth.signInWithEmailAndPassword(e, p).then(() => alert("Welcome Back!")).catch(err => alert(err.message));
}

// Auth State Listener (Runs on page load)
auth.onAuthStateChanged(user => {
    if (user) {
        if(document.getElementById('auth-section')) document.getElementById('auth-section').style.display = 'none';
        if(document.getElementById('dashboard-section')) document.getElementById('dashboard-section').style.display = 'block';
        if(document.getElementById('logout-btn')) {
            const btn = document.getElementById('logout-btn');
            btn.style.display = 'block';
            btn.onclick = () => auth.signOut().then(() => location.reload());
        }
        
        // Load specific data based on page
        if (window.location.pathname.includes('tutor.html')) loadTutorProfile(user.uid);
        if (window.location.pathname.includes('student.html') || window.location.pathname.includes('tutor.html')) loadChats(user.uid);
    }
});

// --- 3. TUTOR PROFILE LOGIC ---

function loadTutorProfile(uid) {
    db.collection('users').doc(uid).get().then(doc => {
        const data = doc.data();
        document.getElementById('tutor-bio').value = data.bio || "";
        document.getElementById('tutor-edu').value = data.education || "";
        if(data.pfp) document.getElementById('current-pfp').src = data.pfp;
    });
}

function saveTutorProfile() {
    const user = auth.currentUser;
    const bio = document.getElementById('tutor-bio').value;
    const edu = document.getElementById('tutor-edu').value;
    const file = document.getElementById('pfp-upload').files[0];

    if (file) {
        const storageRef = storage.ref('pfps/' + user.uid);
        storageRef.put(file).then(snapshot => {
            return snapshot.ref.getDownloadURL();
        }).then(url => {
            updateDb(user.uid, bio, edu, url);
        });
    } else {
        updateDb(user.uid, bio, edu, null);
    }
}

function updateDb(uid, bio, edu, url) {
    let updateData = { bio: bio, education: edu };
    if(url) updateData.pfp = url;

    db.collection('users').doc(uid).update(updateData).then(() => {
        alert("Profile Saved! You are now on the list.");
    });
}

// --- 4. HOME PAGE LIST LOGIC ---

if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
    const list = document.getElementById('tutor-list');
    db.collection('users').where('role', '==', 'tutor').get().then(snapshot => {
        list.innerHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.bio) { // Only show tutors who completed profile
                list.innerHTML += `
                <div class="col-md-4">
                    <div class="card h-100">
                        <img src="${data.pfp}" class="card-img-top" style="height:200px; object-fit:cover;">
                        <div class="card-body">
                            <h5 class="card-title">${data.firstName} ${data.lastName}</h5>
                            <h6 class="text-muted">${data.education}</h6>
                            <p class="card-text">${data.bio.substring(0, 100)}...</p>
                        </div>
                    </div>
                </div>`;
            }
        });
    });
}

// --- 5. AI MATCHING ALGORITHM ---

function runAIMatch() {
    const prompt = document.getElementById('ai-prompt').value.toLowerCase();
    const resultsDiv = document.getElementById('match-results');
    resultsDiv.innerHTML = "Scanning database...";

    // 1. Tokenize the user's input
    const keywords = prompt.split(' ').filter(w => w.length > 3); // simple filter

    db.collection('users').where('role', '==', 'tutor').get().then(snapshot => {
        let scoredTutors = [];

        snapshot.forEach(doc => {
            const tutor = doc.data();
            const tutorId = doc.id;
            
            // 2. AI Scoring Logic: Check overlap between Tutor Bio/Edu and Student Prompt
            let score = 0;
            if (tutor.bio && tutor.education) {
                const tutorText = (tutor.bio + " " + tutor.education).toLowerCase();
                keywords.forEach(word => {
                    if (tutorText.includes(word)) score += 10; // Exact match
                });
                // Add randomness for "AI feel" if scores are tied
                score += Math.random(); 
                
                scoredTutors.push({ ...tutor, id: tutorId, score: score });
            }
        });

        // 3. Sort by score
        scoredTutors.sort((a, b) => b.score - a.score);

        // 4. Display Results
        resultsDiv.innerHTML = "";
        scoredTutors.slice(0, 5).forEach(t => {
            resultsDiv.innerHTML += `
            <a href="#" onclick="startChat('${t.id}', '${t.firstName}')" class="list-group-item list-group-item-action">
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1">${t.firstName} ${t.lastName}</h5>
                    <small class="text-success">${Math.floor(t.score * 10)}% Match</small>
                </div>
                <p class="mb-1">${t.education}</p>
                <small>Click to Chat</small>
            </a>`;
        });
    });
}

// --- 6. CHAT LOGIC ---

function startChat(otherId, otherName) {
    const currentId = auth.currentUser.uid;
    // Create a unique chat ID based on both UIDs (alphabetical order ensures consistency)
    const chatId = [currentId, otherId].sort().join('_');
    
    // Save chat metadata
    db.collection('chats').doc(chatId).set({
        participants: [currentId, otherId],
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    window.location.href = `chat.html?id=${chatId}&name=${otherName}`;
}

function loadChats(uid) {
    db.collection('chats').where('participants', 'array-contains', uid).get().then(snap => {
        const list = document.getElementById('chat-list');
        list.innerHTML = "";
        snap.forEach(doc => {
            // Simple logic to show "Chat [ID]" - in production you'd fetch the other user's name
            list.innerHTML += `<a href="chat.html?id=${doc.id}" class="list-group-item list-group-item-action">Open Chat</a>`;
        });
    });
}

// Chat Page Specifics
if (window.location.pathname.includes('chat.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get('id');
    const chatName = urlParams.get('name');
    
    if(chatName) document.getElementById('chat-header').innerText = "Chatting with " + chatName;

    // Listen for messages
    db.collection('chats').doc(chatId).collection('messages').orderBy('timestamp').onSnapshot(snap => {
        const box = document.getElementById('messages-box');
        box.innerHTML = "";
        snap.forEach(doc => {
            const data = doc.data();
            const align = data.sender === auth.currentUser.uid ? 'text-end' : 'text-start';
            const color = data.sender === auth.currentUser.uid ? 'bg-primary text-white' : 'bg-light';
            
            box.innerHTML += `
            <div class="${align} mb-2">
                <span class="d-inline-block p-2 rounded ${color}">${data.text}</span>
            </div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

function sendMessage() {
    const text = document.getElementById('msg-input').value;
    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get('id');
    
    if(text && chatId) {
        db.collection('chats').doc(chatId).collection('messages').add({
            text: text,
            sender: auth.currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('msg-input').value = "";
    }
}
