/**
 * Envio do formulário "Fale com a equipe" pelo FormSubmit (formsubmit.co), sem servidor.
 *
 * IMPORTANTE, primeiro uso: o FormSubmit manda um e-mail de ativação para o destinatário.
 * Enquanto ninguém clicar em "Activate Form", NENHUMA mensagem é entregue.
 * Em e-mails institucionais, esse aviso costuma cair no spam ou na quarentena.
 *
 * Depois de ativar, o FormSubmit envia um código aleatório. Troque CONTACT_ID por esse código
 * para o e-mail não aparecer no código do site.
 */
export const CONTACT_ID = 'rafaela.parrilla@aluno.senai.br'
export const CONTACT_AJAX = `https://formsubmit.co/ajax/${CONTACT_ID}`
export const CONTACT_FORM = `https://formsubmit.co/${CONTACT_ID}`
