// Db.js
import { db, storage } from "./firebase.js";
import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
    ref, 
    uploadBytes, 
    getDownloadURL, 
    deleteObject 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/* ==================== MÉTODOS DE AGENDAMENTO ==================== */
export async function criarAgendamento(agendamento) {
    try {
        const docRef = await addDoc(collection(db, "agendamentos"), agendamento);
        return docRef.id;
    } catch (error) {
        console.error("Erro ao criar agendamento no Firestore:", error);
        throw error;
    }
}

export function escutarAgendamentos(callback) {
    const q = query(collection(db, "agendamentos"), orderBy("data", "asc"));
    return onSnapshot(q, (snapshot) => {
        const agendamentos = [];
        snapshot.forEach((doc) => {
            agendamentos.push({ id: doc.id, ...doc.data() });
        });
        callback(agendamentos);
    });
}

export async function atualizarAgendamento(id, dadosAtualizados) {
    try {
        const docRef = doc(db, "agendamentos", id);
        await updateDoc(docRef, dadosAtualizados);
    } catch (error) {
        console.error("Erro ao atualizar agendamento:", error);
        throw error;
    }
}

export async function excluirAgendamento(id) {
    try {
        const docRef = doc(db, "agendamentos", id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Erro ao excluir agendamento:", error);
        throw error;
    }
}

/* ==================== MÉTODOS DA GALERIA ==================== */
export async function fazerUploadFoto(file) {
    try {
        const nomeArquivo = `${Date.now()}_${file.name}`;
        const storageRef = ref(storage, `galeria/${nomeArquivo}`);
        const snapshot = await uploadBytes(storageRef, file);
        const urlDownload = await getDownloadURL(snapshot.ref);
        
        const docRef = await addDoc(collection(db, "galeria"), {
            url: urlDownload,
            path: `galeria/${nomeArquivo}`,
            criadoEm: new Date().toISOString()
        });
        
        return { id: docRef.id, url: urlDownload };
    } catch (error) {
        console.error("Erro no upload da foto:", error);
        throw error;
    }
}

export function escutarGaleria(callback) {
    const q = query(collection(db, "galeria"), orderBy("criadoEm", "desc"));
    return onSnapshot(q, (snapshot) => {
        const fotos = [];
        snapshot.forEach((doc) => {
            fotos.push({ id: doc.id, ...doc.data() });
        });
        callback(fotos);
    });
}

export async function excluirFoto(id, pathStorage) {
    try {
        const storageRef = ref(storage, pathStorage);
        await deleteObject(storageRef);
        const docRef = doc(db, "galeria", id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Erro ao remover foto da galeria:", error);
        throw error;
    }
}