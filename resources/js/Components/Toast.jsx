import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import Swal from 'sweetalert2';

export default function Toast() {
    const { props } = usePage();
    
    useEffect(() => {
        // --- SEGURANÇA CONTRA TELA BRANCA E ERROS DE VALIDAÇÃO ---
        const flash = props.flash || {};
        const errors = props.errors || {};

        // Identifica mensagens de erro: prioriza flash.error ou erros gerais retornados por withErrors
        const erroGeral = errors.geral || errors.erro || errors.error || (
            Object.keys(errors).length > 0 && typeof Object.values(errors)[0] === 'string'
                ? Object.values(errors)[0]
                : null
        );
        const erroMsg = flash?.error || erroGeral;

        // Configuração Visual do Toast (Igual ao do Sininho)
        const ToastMixin = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3500,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer);
                toast.addEventListener('mouseleave', Swal.resumeTimer);
            }
        });

        // Verifica qual tipo de mensagem chegou e dispara com feedback garantido
        if (erroMsg) {
            ToastMixin.fire({ icon: 'error', title: erroMsg });
        }
        else if (flash?.success) {
            ToastMixin.fire({ icon: 'success', title: flash.success });
        }
        else if (flash?.warning) {
            ToastMixin.fire({ icon: 'warning', title: flash.warning });
        }
        else if (flash?.message) {
            ToastMixin.fire({ icon: 'info', title: flash.message });
        }

    }, [props.flash, props.errors]); // O 'useEffect' roda toda vez que a mensagem flash mudar

    // Retorna null porque o SweetAlert cria o HTML sozinho flutuando na tela
    return null; 
}