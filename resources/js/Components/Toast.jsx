import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import Swal from 'sweetalert2';

export default function Toast() {
    const { props } = usePage();
    
    // --- SEGURANÇA CONTRA TELA BRANCA ---
    // Usamos '|| {}' para garantir que se 'flash' não existir, o código não quebre.
    const flash = props.flash || {};

    useEffect(() => {
        // Configuração Visual do Toast (Igual ao do Sininho)
        const ToastMixin = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer)
                toast.addEventListener('mouseleave', Swal.resumeTimer)
            }
        });

        // Verifica qual tipo de mensagem chegou e dispara
        if (flash?.success) {
            ToastMixin.fire({ icon: 'success', title: flash.success });
        }
        else if (flash?.error) {
            ToastMixin.fire({ icon: 'error', title: flash.error });
        }
        else if (flash?.warning) {
            ToastMixin.fire({ icon: 'warning', title: flash.warning });
        }
        else if (flash?.message) {
            ToastMixin.fire({ icon: 'info', title: flash.message });
        }

    }, [flash]); // O 'useEffect' roda toda vez que a mensagem flash mudar

    // Retorna null porque o SweetAlert cria o HTML sozinho flutuando na tela
    return null; 
}