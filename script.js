// --- 1. CONFIGURATION ---
// I have updated this with the keys you provided.
const firebaseConfig = {
    apiKey: "AIzaSyAycejhGoOM7ha5svMqwBtVQNlrHt01A_M",
    authDomain: "brightmindsmatch.firebaseapp.com",
    projectId: "brightmindsmatch",
    storageBucket: "brightmindsmatch.firebasestorage.app",
    messagingSenderId: "1007386410464",
    appId: "1:1007386410464:web:609e1316bbf0695e0c7f85",
    measurementId: "G-Y3FHMSR84J"
};

// Initialize Firebase (Compat version for HTML usage)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const analytics = firebase.analytics();

// --- 2. AUTHENTICATION LOGIC ---

// Tutor Sign Up
function tutorSignUp() {
    const fname = document.getElementById('tutor-fname').value;
    const lname = document.getElementById('tutor-lname').value;
    const email = document.getElementById('tutor-email').value;
    
    if(!fname || !lname || !email) {
        alert("Please fill in all fields");
        return;
    }

    const password = fname + "2025!"; // Default Password Logic

    auth.createUserWithEmailAndPassword(email, password).then((cred) => {
        // Create User Document in Firestore
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
        alert("Tutor account created! Your password is: " + password);
        window.location.reload();
    }).catch(err => alert("Error: " + err.message));
}

// Student Sign Up
function studentSignUp() {
    const fname = document.getElementById('stu-fname').value;
    const lname = document.getElementById('stu-lname').value;
    const email = document.getElementById('stu-email').value;
    const password = document.getElementById('stu-pass').value;

    if(!fname || !lname || !email || !password) {
        alert("Please fill in all fields");
        return;
    }

    auth.createUserWithEmailAndPassword(email, password).then((cred) => {
        return db.collection('users').doc(cred.user.uid).set({
            firstName: fname,
            lastName: lname,
            email: email,
            role: 'student'
        });
    }).then(() => {
        alert("Student account created!");
        window.location.reload();
    }).catch(err => alert("Error: " + err.message));
}

// Login Function (Used by both)
function handleLogin(type) {
    const emailId = type === 'tutor' ? 'tutor-login-email' : 'stu-login-email';
    const passId = type === 'tutor' ? 'tutor-login-pass' : 'stu-login-pass';
    
    const email = document.getElementById(emailId).value;
    const password = document.getElementById(passId).value;

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            console.log("Logged in successfully");
            // The onAuthStateChanged listener will handle the UI switch
        })
        .catch(err => alert("Login Failed: " + err.message));
}

// Global Auth Listener
auth.onAuthStateChanged(user => {
    if (user) {
        console.log("User is signed in:", user.uid);
        
        // Hide auth forms, Show dashboard
        if(document.getElementById('auth-section')) document.getElementById('auth-section').style.display = 'none';
        if(document.getElementById('dashboard-section')) document.getElementById('dashboard-section').style.display = 'block';
        
        // Show Logout Button
        const logoutBtn = document.getElementById('logout-btn');
        if(logoutBtn) {
            logoutBtn.style.display = 'block';
            logoutBtn.onclick = () => auth.signOut().then(() => window.location.reload());
        }
        
        // Page Specific Data Loading
        if (window.location.pathname.includes('tutor.html')) loadTutorProfile(user.uid);
        
        // Load chats for both students and tutors
        loadChats(user.uid);
    }
});

// --- 3. TUTOR PROFILE LOGIC ---

function loadTutorProfile(uid) {
    db.collection('users').doc(uid).get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('tutor-bio').value = data.bio || "";
            document.getElementById('tutor-edu').value = data.education || "";
            if(data.pfp) document.getElementById('current-pfp').src = data.pfp;
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

    // Helper to update Firestore
    const updateFirestore = (url) => {
        let updateData = { bio: bio, education: edu };
        if(url) updateData.pfp = url;

        db.collection('users').doc(user.uid).update(updateData).then(() => {
            alert("Profile Saved! You are now listed on the homepage.");
            saveBtn.innerText = "Save Profile & Go Live";
            saveBtn.disabled = false;
        }).catch(err => {
            alert("Error saving profile: " + err.message);
            saveBtn.innerText = "Save Profile & Go Live";
            saveBtn.disabled = false;
        });
    };

    if (file) {
        // Upload Image
        const storageRef = storage.ref('pfps/' + user.uid);
        storageRef.put(file).then(snapshot => {
            return snapshot.ref.getDownloadURL();
        }).then(url => {
            document.getElementById('current-pfp').src = url;
            updateFirestore(url);
        }).catch(err => {
            alert("Image upload failed: " + err.message);
            saveBtn.disabled = false;
        });
    } else {
        updateFirestore(null);
    }
}

// --- 4. HOME PAGE LIST LOGIC ---

// Runs on index.html
if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
    const list = document.getElementById('tutor-list');
    if (list) {
        db.collection('users').where('role', '==', 'tutor').get().then(snapshot => {
            list.innerHTML = "";
            if(snapshot.empty) {
                list.innerHTML = "<p class='text-center'>No tutors found yet. Be the first to sign up!</p>";
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                // Only show tutors who have filled out their bio
                if (data.bio && data.bio.length > 0) {
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
        }).catch(err => {
            console.error(err);
            list.innerHTML = "<p class='text-center text-danger'>Error loading tutors. Check console.</p>";
        });
    }
}

// --- 5. AI MATCHING ALGORITHM ---

function runAIMatch() {
    const promptInput = document.getElementById('ai-prompt');
    const resultsDiv = document.getElementById('match-results');
    
    if(!promptInput.value) {
        alert("Please describe what you need help with!");
        return;
    }

    resultsDiv.innerHTML = "<div class='text-center'>Scanning database... <div class='spinner-border spinner-border-sm'></div></div>";

    const promptText = promptInput.value.toLowerCase();
    // Simple tokenizer: remove common words, keep keywords > 3 chars
    const keywords = promptText.split(' ').filter(w => w.length > 3); 

    db.collection('users').where('role', '==', 'tutor').get().then(snapshot => {
        let scoredTutors = [];

        snapshot.forEach(doc => {
            const tutor = doc.data();
            const tutorId = doc.id;
            
            // AI Matching Logic
            let score = 0;
            if (tutor.bio && tutor.education) {
                const tutorText = (tutor.bio + " " + tutor.education).toLowerCase();
                
                keywords.forEach(word => {
                    // Exact keyword match logic
                    if (tutorText.includes(word)) score += 10; 
                });
                
                // Add tiny random float to prevent exact ties
                score += Math.random(); 
                
                scoredTutors.push({ ...tutor, id: tutorId, score: score });
            }
        });

        // Sort by highest score first
        scoredTutors.sort((a, b) => b.score - a.score);

        // Render Results
        resultsDiv.innerHTML = "";
        if(scoredTutors.length === 0) {
            resultsDiv.innerHTML = "<p>No matching tutors found.</p>";
            return;
        }

        scoredTutors.slice(0, 5).forEach(t => {
            const matchPercent = Math.min(100, Math.floor(t.score * 5)); // Fake percentage for UX
            resultsDiv.innerHTML += `
            <a href="#" onclick="startChat('${t.id}', '${t.firstName}')" class="list-group-item list-group-item-action">
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1">${t.firstName} ${t.lastName}</h5>
                    <span class="badge bg-success">${matchPercent}% Match</span>
                </div>
                <p class="mb-1 small">${t.education}</p>
                <small class="text-primary">Click to Chat</small>
            </a>`;
        });
    });
}

// --- 6. CHAT LOGIC ---

function startChat(otherId, otherName) {
    const user = auth.currentUser;
    if(!user) {
        alert("You must be logged in to chat.");
        return;
    }

    const currentId = user.uid;
    // Create a unique chat ID based on alphabetical order of UIDs (so A->B and B->A is same Chat ID)
    const chatId = [currentId, otherId].sort().join('_');
    
    // Create/Update Chat Metadata
    db.collection('chats').doc(chatId).set({
        participants: [currentId, otherId],
        participantNames: firebase.firestore.FieldValue.arrayUnion(otherName), // Store name for easy display
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
        if(snap.empty) {
            list.innerHTML = "<div class='text-muted p-2'>No active chats.</div>";
            return;
        }
        
        snap.forEach(doc => {
            const data = doc.data();
            list.innerHTML += `<a href="chat.html?id=${doc.id}" class="list-group-item list-group-item-action">Open Chat</a>`;
        });
    });
}

// Chat Page Specifics
if (window.location.pathname.includes('chat.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get('id');
    const chatName = urlParams.get('name');
    
    if(chatName) document.getElementById('chat-header').innerText = "Chat with " + chatName;

    if(chatId) {
        // Listen for messages in real-time
        db.collection('chats').doc(chatId).collection('messages').orderBy('timestamp').onSnapshot(snap => {
            const box = document.getElementById('messages-box');
            box.innerHTML = "";
            snap.forEach(doc => {
                const data = doc.data();
                const isMe = data.sender === auth.currentUser?.uid;
                const align = isMe ? 'text-end' : 'text-start';
                const color = isMe ? 'bg-primary text-white' : 'bg-secondary text-white';
                
                box.innerHTML += `
                <div class="${align} mb-2">
                    <span class="d-inline-block p-2 rounded ${color}" style="max-width:75%;">${data.text}</span>
                </div>`;
            });
            // Auto scroll to bottom
            box.scrollTop = box.scrollHeight;
        });
    }
}

function sendMessage() {
    const text = document.getElementById('msg-input').value;
    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get('id');
    const user = auth.currentUser;
    
    if(text && chatId && user) {
        db.collection('chats').doc(chatId).collection('messages').add({
            text: text,
            sender: user.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update main chat doc timestamp
        db.collection('chats').doc(chatId).update({
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('msg-input').value = "";
    }
}
