const menuBtn = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");

menuBtn.addEventListener("click", () => {
    navLinks.classList.toggle("active");
});

const introButtons = document.querySelectorAll(".intro-btn");

introButtons.forEach((button) => {

    button.addEventListener("click", () => {

        const text = button.nextElementSibling;

        text.classList.toggle("show");

        if(text.classList.contains("show")){
            text.style.display = "block";
        }

        else{
            text.style.display = "none";
        }

    });

});