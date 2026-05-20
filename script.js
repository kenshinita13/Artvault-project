function showForm(formId) {
document.querySelectorAll(".form-box").forEach(form => form.classList.remove("active"));
document.getElementById(formId).classList.add("active");
}

function openModal(src) {
    document.getElementById("imgModal").style.display = "block";
    document.getElementById("modalImg").src = src;
}

function closeModal() {
    document.getElementById("imgModal").style.display = "none";
}
