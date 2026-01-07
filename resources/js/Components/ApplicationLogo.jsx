export default function ApplicationLogo(props) {
    return (
        <img 
            src="/img/logo.png" 
            alt="Shineray Logo" 
            {...props} 
            className={`h-30 w-auto object-contain ${props.className}`}
        />
    );
}