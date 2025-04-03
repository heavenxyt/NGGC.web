import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

// Initialize Supabase client
const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

// DOM Elements
const authSection = document.getElementById('auth-section');
const chatInterface = document.getElementById('chat-interface');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-message');
const messagesContainer = document.getElementById('messages');
const profileModal = document.getElementById('profile-modal');
const editProfileButton = document.getElementById('edit-profile');
const profileForm = document.getElementById('profile-form');
const authTabs = document.querySelectorAll('.auth-tab');
const authForms = document.querySelectorAll('.auth-form');

// Auth State Management
let currentUser = null;

// Initialize AOS
AOS.init({
    duration: 800,
    easing: 'ease-out',
    once: true
});

// Auth Tab Switching
authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetForm = tab.dataset.tab;
        
        // Update active states
        authTabs.forEach(t => t.classList.remove('active'));
        authForms.forEach(f => f.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(`${targetForm}-form`).classList.add('active');
    });
});

// Login Handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        currentUser = data.user;
        showChat();
    } catch (error) {
        console.error('Login error:', error.message);
        alert('Login failed: ' + error.message);
    }
});

// Signup Handler
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const username = document.getElementById('signup-username').value;

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username
                }
            }
        });

        if (error) throw error;

        alert('Signup successful! Please log in.');
        
        // Switch to login tab
        authTabs[0].click();
    } catch (error) {
        console.error('Signup error:', error.message);
        alert('Signup failed: ' + error.message);
    }
});

// Show Chat Interface
function showChat() {
    authSection.classList.add('hidden');
    chatInterface.classList.remove('hidden');
    loadMessages();
    subscribeToMessages();
}

// Load Messages
async function loadMessages() {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*, profiles(username)')
            .order('created_at', { ascending: true });

        if (error) throw error;

        displayMessages(data);
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// Display Messages
function displayMessages(messages) {
    messagesContainer.innerHTML = '';
    
    messages.forEach(message => {
        const messageElement = createMessageElement(message);
        messagesContainer.appendChild(messageElement);
    });

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Create Message Element
function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message ${message.user_id === currentUser?.id ? 'own-message' : ''}`;
    
    const time = format(new Date(message.created_at), 'HH:mm');
    
    div.innerHTML = `
        <div class="message-header">
            <span class="message-username">${message.profiles.username}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-content">
            ${message.content}
            ${message.image_url ? `<img src="${message.image_url}" alt="Shared image" class="message-image">` : ''}
        </div>
    `;

    return div;
}

// Send Message
async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content) return;

    try {
        const { error } = await supabase
            .from('messages')
            .insert([
                {
                    content,
                    user_id: currentUser.id
                }
            ]);

        if (error) throw error;

        messageInput.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message');
    }
}

// Subscribe to Real-time Messages
function subscribeToMessages() {
    supabase
        .channel('public:messages')
        .on('postgres_changes', 
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            },
            payload => {
                const messageElement = createMessageElement(payload.new);
                messagesContainer.appendChild(messageElement);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        )
        .subscribe();
}

// Event Listeners
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Profile Modal Handlers
editProfileButton.addEventListener('click', () => {
    profileModal.style.display = 'flex';
});

profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const displayName = document.getElementById('display-name').value;
    const avatarUrl = document.getElementById('avatar-url').value;
    const status = document.getElementById('user-status').value;

    try {
        const { error } = await supabase
            .from('profiles')
            .update({
                username: displayName,
                avatar_url: avatarUrl,
                status
            })
            .eq('id', currentUser.id);

        if (error) throw error;

        profileModal.style.display = 'none';
        // Update UI with new profile info
        document.getElementById('username').textContent = displayName;
        document.getElementById('user-avatar').src = avatarUrl || 'https://via.placeholder.com/40';
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Failed to update profile');
    }
});

// Close modal when clicking outside
profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) {
        profileModal.style.display = 'none';
    }
});

// Check auth state on load
supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
        currentUser = session.user;
        showChat();
    }
});